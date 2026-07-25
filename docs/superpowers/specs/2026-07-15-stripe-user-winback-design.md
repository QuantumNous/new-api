# Stripe 用户召回活动设计

- 日期：2026-07-15
- 状态：设计已确认，待实施计划
- 范围：Flatkey 管理后台、Stripe 支付、邮件触达与转化归因

## 1. 背景

Flatkey 需要面向符合条件的沉默或流失用户发放 Stripe 原生优惠，吸引用户重新购买。折扣必须由 Stripe 执行和核销；Flatkey 只负责筛选人群、编排活动、创建或绑定 Stripe Coupon、为每位用户生成专属 Promotion Code、发送邮件以及记录转化。

现有代码已经具备以下基础：

- Stripe 余额充值 Checkout 已开启 `AllowPromotionCodes`，用户可以手动输入 Promotion Code。
- Stripe 订阅 Checkout 已存在，但尚未开启 Promotion Code，也没有自动应用专属优惠的入口。
- 用户表已有 `StripeCustomer`、注册时间、最后登录时间、余额和累计请求数。
- 充值订单、订阅订单、用户订阅和 API 消费日志可以支持人群判断与付款归因。
- API 消费日志可能位于独立 `LOG_DB`，设计不能依赖主库与日志库跨库 JOIN。
- 生产是多节点部署，发券、邮件和 Webhook 处理必须跨节点幂等。

Stripe 对象职责如下：

- Coupon 定义折扣规则。
- Promotion Code 是用户可使用的兑换码，并可限制 Customer、兑换次数、有效期和最低消费。
- 本功能采用“活动级 Coupon + 用户级 Promotion Code”，不使用 Flatkey 本地赠送额度。

## 2. 目标

1. 提供首充召回、沉默付费用户和订阅流失用户三类内置人群模板。
2. 每个活动可以调整模板阈值、Stripe 优惠、执行方式、适用产品和邮件序列。
3. 支持自动创建 Stripe Coupon，也支持绑定已有 Coupon ID。
4. 为每位用户创建绑定其 Stripe Customer、最多兑换一次且有明确有效期的 Promotion Code。
5. 支持人工预览确认和定时自动运行。
6. 支持配置 1 至 3 封邮件，并在用户兑换、退订、付款或重新活跃后停止后续邮件。
7. 邮件同时提供优惠码和“立即使用”按钮；按钮在正确账号下自动将 Promotion Code 应用到 Stripe Checkout。
8. 通过现有付款完成路径和 Stripe Webhook 记录兑换、收入与折扣成本。
9. 在多节点、任务重试、Webhook 重放和服务重启下避免重复发券和重复业务入账。

## 3. 非目标

- 不实现 Flatkey 本地余额赠送、充值返额或本地优惠计算。
- 不支持 Stripe 之外的支付渠道使用召回优惠。
- 不建设通用 AND/OR 规则引擎；第一版只提供三个内置模板及其参数。
- 不让一个活动同时使用多套折扣。不同人群或不同折扣力度使用不同活动。
- 不自动合并或替换现有历史邮件召回分支。
- 不引入新的外部营销自动化平台或邮件供应商。
- 不使用 Stripe `first_time_transaction` 限制，因为它不适合同时覆盖老付费用户，且其首次交易口径与 Flatkey 业务口径不同。

## 4. 已确认的产品决策

| 维度 | 决策 |
| --- | --- |
| 人群配置 | 三个内置模板，分别调整阈值 |
| 支付范围 | 只对 Stripe Checkout 生效；充值和订阅产品分别选择 |
| 优惠来源 | 可自动创建 Coupon，也可绑定已有 Coupon |
| 优惠形式 | 百分比或固定金额，可配置力度、币种、最低消费和 Promotion Code 有效期 |
| 用户隔离 | 每用户独立 Promotion Code，绑定 Stripe Customer，最多兑换一次 |
| 缺少 Customer | 发券时按 Flatkey 账户邮箱创建 Stripe Customer 并回写用户 |
| 执行方式 | 每个活动可选人工确认、一次性排期或周期性自动筛选 |
| 邮件序列 | 每个活动配置 1 至 3 封及其间隔 |
| 自动使用 | 邮件按钮自动应用优惠，同时显示可手动输入的兑换码 |
| 暂停与取消 | 停止新发券和后续邮件；已发优惠继续有效到原定到期日 |

## 5. 总体架构

采用数据库驱动的任务状态机，而不是在一次 HTTP 请求中同步完成批量发券和发信。

```text
管理后台
   │ 创建、预览、激活、暂停活动
   ▼
召回活动服务
   │ 固化候选用户快照
   ▼
数据库任务状态机
   ├── 确保 Stripe Customer
   ├── 创建或校验活动 Coupon
   ├── 创建专属 Promotion Code
   ├── 安排并发送 1–3 封邮件
   └── 重试、对账与审计
   ▼
Stripe Checkout / Webhook ──► 兑换与收入归因
```

组件边界：

- **候选筛选器**：只计算资格和排除原因，不调用 Stripe、不发邮件。
- **活动服务**：管理配置、状态转换、快照和权限。
- **Stripe 召回适配器**：封装 Coupon、Customer、Promotion Code、产品校验和对账操作。
- **任务执行器**：跨节点领取任务、执行外部调用、退避重试和记录结果。
- **邮件序列服务**：渲染模板、执行退订检查、安排阶段邮件并记录供应商结果。
- **兑换归因器**：在现有付款完成后读取 Promotion Code 或活动元数据，更新召回结果。

这些组件通过模型层接口交互，controller 不直接包含筛选 SQL、Stripe 编排或任务状态机逻辑。

## 6. 数据模型

所有新增模型通过 GORM 实现，并兼容 SQLite、MySQL 5.7.8+ 和 PostgreSQL 9.6+。灵活配置和快照使用 `TEXT` 保存 JSON，不使用数据库专属 JSON 类型。

### 6.1 `recall_campaigns`

保存一个活动及其不可变优惠定义。

核心字段：

- `id`、`name`、`status`
- `audience_template`：`first_purchase`、`lapsed_payer` 或 `expired_subscription`
- `audience_config`：模板阈值 JSON
- `execution_mode`：`manual`、`scheduled_once` 或 `recurring`
- `scheduled_at`、`recurrence_config`、`next_run_at`；周期任务只支持按指定时区每日或每周运行，不开放任意 cron 表达式
- `coupon_source`：`automatic` 或 `existing`
- `stripe_coupon_id`
- `discount_config`：折扣类型、力度、币种和最低消费
- `product_scope`：允许的充值 Price 和订阅 Price 快照
- `promotion_valid_seconds`
- `email_sequence_config`：1 至 3 个阶段、间隔和模板版本
- `created_by`、`created_at`、`updated_at`、`activated_at`、`completed_at`

活动激活后锁定人群模板、Coupon、折扣、适用产品和 Promotion Code 有效期。邮件文案可以为尚未创建的后续任务发布新版本，但已经排队的邮件保留模板版本快照。

### 6.2 `recall_recipients`

保存活动用户快照和每用户 Stripe 对象。

核心字段：

- `campaign_id`、`user_id`
- `eligibility_snapshot`、`email_snapshot`、`language_snapshot`
- `state`：`queued`、`customer_ready`、`code_ready`、`contacting`、`converted`、`suppressed`、`ineligible`、`expired` 或 `failed`
- `stripe_customer_id`
- `stripe_promotion_code_id`、`promotion_code`
- `promotion_expires_at`
- `claim_token_hash`
- `first_sent_at`、`last_sent_at`、`clicked_at`
- `converted_at`、`conversion_trade_no`、`conversion_currency`、`conversion_amount`、`discount_amount`
- `last_error_code`、`last_error_message`
- `created_at`、`updated_at`

约束：

- 唯一索引 `(campaign_id, user_id)`，同一用户在同一活动只能入组一次。
- 唯一索引 `stripe_promotion_code_id`，用于 Webhook 快速归因。
- Promotion Code 不写入普通应用日志；管理后台默认掩码显示。

### 6.3 `recall_messages`

保存每个用户每个邮件阶段的独立任务。

核心字段：

- `recipient_id`、`stage_no`、`template_version`
- `scheduled_at`、`state`
- `attempt_count`、`next_attempt_at`
- `lease_owner`、`lease_expires_at`
- `provider_message_id`
- `accepted_at`、`failed_at`
- `last_error_code`、`last_error_message`

唯一索引 `(recipient_id, stage_no)` 防止重复安排同一阶段。

### 6.4 `recall_events`

保存活动状态变化、用户入组、发券、邮件、点击、付款和 Stripe Webhook 等审计事件。

核心字段：

- `campaign_id`、`recipient_id`、`event_type`
- `source`、`source_event_id`
- `event_data`
- `created_at`

对 Stripe 事件使用唯一索引 `(source, source_event_id)`，保证 Webhook 重放幂等。`event_data` 只保存归因所需字段，不复制完整 Stripe 或邮件载荷。

### 6.5 全局退订

在现有用户设置中新增召回营销邮件退订标记，并在 `recall_events` 记录退订来源和时间。它对所有当前和未来召回活动生效；交易邮件和安全邮件不受影响。

## 7. 人群模板

### 7.1 首充召回 `first_purchase`

可配置条件：

- 注册至少多少天
- 最低累计 API 请求量
- 当前余额上限
- 用户组白名单或黑名单
- 是否要求已验证邮箱

固定条件：用户有效、邮箱可发送、在所有支付渠道中都没有成功充值或订阅付款记录、未全局退订。

### 7.2 沉默付费用户 `lapsed_payer`

可配置条件：

- 最低历史成功付款金额
- 距离最近 API 消费的天数
- 当前余额上限
- 最近付款距今天数
- 历史付款渠道范围
- 用户组白名单或黑名单

固定条件：至少有一笔成功付款、用户有效、邮箱可发送、未全局退订。

### 7.3 订阅流失用户 `expired_subscription`

可配置条件：

- 距离最近订阅到期或失效的天数
- 最低历史订阅金额或次数
- 距离最近 API 消费的天数
- 历史订阅支付渠道范围
- 用户组白名单或黑名单

固定条件：当前没有有效订阅、用户有效、邮箱可发送、未全局退订。

### 7.4 跨库筛选

主库先根据用户、付款和订阅条件产生有限的候选 ID 集合；候选筛选器再按批次从 `LOG_DB` 查询指定时间窗内的 API 消费用户并排除近期活跃者。不得直接跨库 JOIN。

预览返回总数、分页样本和结构化排除原因，不调用 Stripe 或邮件服务。人工激活或自动运行时重新计算一次资格并固化快照，避免使用过期预览结果。

周期性活动每次只加入此前未进入该活动的新用户；同一用户如需再次召回，应创建新活动，而不是绕过唯一约束。

## 8. Stripe 设计

### 8.1 Coupon

自动创建 Coupon 时：

- 百分比优惠使用 `percent_off`，可以覆盖活动选中的多个付款币种。
- 固定金额优惠使用 `amount_off`，一个活动只允许一种币种；需要其他币种时创建独立活动。
- 适用范围限制为活动选中的 Stripe Products。
- Coupon 使用一次性折扣语义：充值只折扣当前 Checkout，订阅只折扣首个符合条件的账单。多账期或永久订阅折扣不属于第一版。
- 不启用 `first_time_transaction`。

绑定已有 Coupon 时，激活前从 Stripe 读取并校验：存在、可用、未过期、币种兼容、适用产品符合活动选择且剩余兑换能力足够。已有 Coupon 的实际 Stripe 属性只读显示，Flatkey 不尝试覆盖。

Stripe Coupon 按 Product 限制，而 Flatkey 当前配置主要保存 Price ID。后台选择购买项后，服务端必须读取 Price 并解析 Product ID；如果多个不应共同优惠的 Price 共享同一 Product，激活前阻止该配置并说明 Stripe 无法按 Price 精确隔离。

### 8.2 Stripe Customer

处理用户任务时：

1. 如果 `User.StripeCustomer` 有值，先验证 Customer 仍可用。
2. 如果不存在或已被 Stripe 删除，使用 Flatkey 用户 ID 级别的确定性幂等键创建 Customer。
3. Customer 使用账户邮箱，并写入 `flatkey_user_id` 元数据。
4. 将返回 ID 同时写入用户和召回用户记录；并发更新使用条件写入，避免互相覆盖。

Stripe Customer 创建失败只影响该用户，不使整个活动失败。

### 8.3 Promotion Code

每个 `recall_recipient` 创建一个随机、不可预测且便于人工输入的 Promotion Code：

- 绑定活动 Coupon 和目标 Stripe Customer。
- `max_redemptions = 1`。
- `expires_at` 不超过活动配置和 Coupon 自身截止时间。
- 可配置最低消费及对应币种。
- Stripe 元数据包含 campaign ID、recipient ID 和 Flatkey user ID。
- Stripe 幂等键由 campaign ID 与 recipient ID 确定。

若随机 code 碰撞，生成新 code 后有限次数重试；不得退回共享码。

### 8.4 Checkout 自动应用

邮件包含显示用 Promotion Code 和带随机 claim token 的“立即使用”链接。数据库只存 token 哈希。

流程：

1. 用户打开链接；未登录时先登录，并保留 claim。
2. 后端验证 token、有效期、活动用户、当前登录 user ID 和 Promotion Code 状态。
3. 钱包页面显示优惠已领取及其适用购买项。
4. 创建 Stripe Checkout 时传入 claim；后端再次验证产品和用户，并通过 `Discounts.PromotionCode` 自动应用。
5. 自动应用时不同时设置 `AllowPromotionCodes`；普通 Checkout 继续允许手动输入 Promotion Code。

充值和订阅 Checkout 共用同一验证服务。订阅 Stripe Checkout 需要补充普通手动输入能力；任何非 Stripe 支付入口忽略并拒绝 recall claim。

## 9. 活动与任务状态机

### 9.1 活动状态

```text
draft -> scheduled -> running -> completed
  │          │           │
  │          ├──────────> paused -> running
  │          │              │
  └──────────┴──────────────┴────> cancelled
```

- `draft`：可编辑、可预览，没有外部副作用。
- `scheduled`：等待一次性或周期性触发。
- `running`：可以入组新用户和处理任务。
- `paused`：不领取新任务，不安排后续邮件；已经发送的 Promotion Code 继续有效。
- `cancelled`：永久停止新任务和邮件，并将尚未开始的本地任务置为取消；已发码不撤销。
- `completed`：一次性活动所有可处理任务进入终态，或管理员结束周期性活动。

状态切换使用数据库条件更新，重复请求保持幂等。

### 9.2 用户处理顺序

```text
queued
  -> customer_ready
  -> code_ready
  -> contacting
  -> converted | suppressed | ineligible | expired | failed
```

每一步只在前置状态满足时执行。外部调用成功后持久化对象 ID，再推进状态。可重试错误保留当前阶段；永久错误进入 `failed` 并展示可操作原因。

### 9.3 邮件停止条件

每封邮件发送前重新检查：

- 活动仍允许发送。
- 用户和邮箱仍有效。
- 用户未全局退订。
- Promotion Code 尚未兑换或过期。
- 用户没有在入组后完成新的付款。
- 用户没有按该模板定义重新变为活跃。

任何停止条件命中时，取消剩余邮件但不撤销已发 Promotion Code。

## 10. 邮件序列

每个活动配置 1 至 3 个阶段，包含：

- 相对首次发送的间隔
- 主题和正文模板版本
- 按用户语言选择模板
- 显示的折扣、有效期、适用产品和 Promotion Code
- 自动使用按钮和退订链接

继续使用现有邮件发送设施，不增加新供应商依赖。

邮件任务使用数据库租约避免多节点同时发送。SMTP 或普通邮件 API 通常没有严格幂等保证，因此出现“供应商可能已接收、但本地未确认”的不确定状态时，不自动重发，进入人工重试列表。系统使用稳定 `Message-ID` 降低重复展示风险，但不声称邮件可以做到严格 exactly-once。

当前邮件设施如果只能确认 SMTP 接受，则指标名称使用“已接受/已发送”，不把它误报为“已送达”。只有供应商提供可验证 delivery webhook 时才记录送达事件。

点击由 claim 链接记录为“观察到点击”；邮件安全扫描器可能产生点击，因此点击不等同于真人访问或转化。

## 11. 兑换和收入归因

归因挂接在现有 Stripe 付款完成和订单履约成功之后，不改变现有入账事务的正确性。

归因优先级：

1. Checkout 或账单实际使用的 Promotion Code ID 匹配 `recall_recipients`，记为直接兑换。
2. Checkout 带有已验证 recall claim 元数据且实际付款成功，记为活动辅助转化；若没有使用优惠，单独标识为无券回流。
3. 仅点击或重新活跃但未付款，不计收入转化，但会停止后续骚扰式邮件。

成功归因保存本地订单号、Stripe 对象 ID、付款金额、币种和实际折扣金额。Webhook Event ID 唯一，重复投递不会重复转化或重复入账。

多币种指标按币种分别汇总，不直接把不同币种金额相加。汇率换算不属于第一版范围。

定期对账任务查询尚未终态的 Promotion Code 和关联付款，补偿漏掉的 Webhook。对账只修复召回状态，不重复执行现有付款入账。

## 12. 管理后台

### 12.1 活动列表

展示名称、人群模板、状态、执行方式、预计和实际入组人数、发券数、邮件数、兑换数、召回收入、折扣成本和最近运行时间。

### 12.2 创建与编辑

分区配置：

1. 活动名称和人群模板。
2. 模板阈值。
3. 自动 Coupon 或已有 Coupon。
4. 百分比/固定金额、币种、最低消费、有效期和适用 Stripe 购买项。
5. 人工、一次性排期或周期性执行。
6. 1 至 3 封邮件及其间隔。

保存草稿时只做本地校验；预览时执行只读筛选和 Stripe 产品/Coupon 只读校验；激活时再次校验并固化配置快照。

### 12.3 用户和任务详情

展示资格快照、Stripe Customer、掩码 Promotion Code、邮件阶段、点击、转化、错误和审计时间线。管理员可以重试明确失败的单用户任务，但不能绕过唯一约束重新发同一阶段邮件。

### 12.4 操作

- 预览候选用户和排除原因
- 激活、排期、暂停、恢复、取消和结束
- 重试失败任务
- 导出活动结果

危险操作需要二次确认；取消活动不会撤销已发码，并在界面明确提示。

## 13. API 边界

管理 API 放在管理员鉴权路由下，覆盖：

- 活动 CRUD、预览和状态转换
- 活动用户、任务、事件和指标查询
- 单用户失败任务重试
- Stripe Coupon/Price/Product 只读校验

用户 API 覆盖：

- claim 校验与当前账号绑定
- 钱包页查询当前 claim 的适用产品和展示信息
- Stripe Checkout 创建时提交 claim
- 召回邮件全局退订

管理员 API 不返回完整 claim token；普通用户只能查看属于当前账号的召回优惠。

## 14. 并发、幂等与多节点

- 调度触发可以限制在 master 节点，但正确性不依赖该限制。
- 自动活动每次运行记录唯一 run key，重复调度不会重复产生同一批次。
- `(campaign_id, user_id)` 唯一索引裁决并发入组。
- `(recipient_id, stage_no)` 唯一索引裁决邮件阶段创建。
- worker 使用带过期时间的数据库租约和条件更新领取任务。
- Stripe Customer、Coupon 和 Promotion Code 使用稳定幂等键。
- Stripe Webhook Event ID 使用唯一索引。
- 状态更新只允许合法的前置状态，迟到响应不能覆盖终态。
- 进程内锁和 `sync.Once` 只可用于性能优化，不可承担业务防重。

## 15. 错误处理

错误分为三类：

- **可重试**：网络超时、Stripe 429/5xx、邮件临时失败、数据库瞬时错误。采用有上限的指数退避和抖动。
- **永久失败**：邮箱无效、Coupon 不存在、产品不兼容、用户被禁用、Stripe Customer 不可恢复。记录结构化错误并停止该用户或活动。
- **不确定外部结果**：外部服务可能成功但本地未确认。Stripe 通过幂等键安全重试；邮件进入人工复核，不自动重复发送。

活动级配置错误在激活前阻止启动。单用户错误不会拖垮整个活动。错误消息不得包含 Stripe 密钥、claim token、完整 Promotion Code 或邮件正文。

## 16. 安全、隐私与合规

- Stripe API Secret 继续使用现有安全配置，不进入数据库活动配置。
- claim token 使用密码学安全随机数，数据库只保存哈希，并绑定用户、活动和有效期。
- Promotion Code 虽受 Customer 约束，仍按敏感运营数据处理，不写普通日志。
- 退订链接不要求登录，并采用不可猜测 token；成功后立即全局抑制召回邮件。
- 管理接口使用 AdminAuth，导出和重试操作写审计事件。
- 候选预览和事件数据只保留业务需要的最少用户信息。
- Stripe Customer 创建使用 Flatkey 账户邮箱，不从邮件链接接受可替换邮箱。
- 产品、用户和 Promotion Code 在创建 Checkout 时再次验证，不能只信任前端。

## 17. 指标

按活动和币种展示：

- 候选数、入组数、排除数
- Customer 创建成功/失败数
- Promotion Code 创建成功/失败数
- 邮件已安排、已接受、失败和取消数
- 观察到点击数
- 直接兑换数、辅助转化数、无券回流数
- 兑换率、付款金额和实际折扣成本

成功指标以实际付款和 Promotion Code 归因为准，不以邮件点击作为收入转化。

## 18. 测试与验证

### 18.1 单元测试

- 三个人群模板的边界、阈值和排除原因
- 主库候选与 `LOG_DB` 活跃用户分批排除
- Coupon 配置校验、Price 到 Product 解析和共享 Product 冲突
- claim token 生成、哈希、过期、错账号和错产品
- 活动、用户和邮件状态转换
- 邮件停止条件和全局退订
- 归因优先级和多币种汇总

### 18.2 模型与并发测试

- 同一活动并发入组同一用户只产生一条记录
- 多 worker 竞争同一任务只有一个获得租约
- 租约过期后可以被安全接管
- 同一邮件阶段只创建一次
- 重复 Stripe Event 只处理一次
- SQLite、MySQL 和 PostgreSQL 迁移与查询兼容

### 18.3 Stripe 适配器测试

使用可替换的 Stripe 客户端接口和 fake 实现验证：

- 自动创建 Coupon 与绑定已有 Coupon
- Customer 已存在、缺失和已删除
- Promotion Code 的 Customer、次数、有效期、最低消费和元数据
- 429、5xx、超时和幂等重试
- 自动应用和手动输入两种 Checkout 参数互斥
- 充值与订阅产品范围校验

### 18.4 Controller 与权限测试

- 非管理员不能创建、预览或操作活动
- 预览没有 Stripe 或邮件副作用
- 用户不能领取其他账号的 claim
- 非 Stripe 支付不能使用 recall claim
- 退订立即阻止后续邮件

### 18.5 Stripe Test Mode 验收

在 staging 使用 Stripe Test Mode 完成：

1. 创建自动 Coupon 活动并预览用户。
2. 为无 Customer 用户创建 Customer 和专属 Promotion Code。
3. 验证邮件展示码和自动应用按钮。
4. 分别完成一次充值 Checkout 和一次订阅 Checkout。
5. 验证折扣、订单履约、Webhook 重放、转化金额和后续邮件停止。
6. 暂停或取消活动，确认已发码仍可用、新任务停止。
7. 模拟 Stripe 429、邮件失败、worker 重启和多节点竞争。

生产启用前先用小规模人工确认活动验证真实邮件文案和 Stripe 配置，再开放周期性自动活动。

## 19. 验收标准

1. 管理员可以基于三个模板创建、预览并运行召回活动。
2. 预览不会创建任何 Stripe 对象或发送邮件。
3. 支持自动 Coupon 和已有 Coupon，支持百分比与固定金额配置。
4. 每个入组用户最多拥有一个绑定其 Stripe Customer 的活动 Promotion Code。
5. 无 Stripe Customer 的用户可以在发券阶段自动创建 Customer。
6. 人工、一次性排期和周期性执行共用同一套幂等状态机。
7. 1 至 3 封邮件按配置执行，并在停止条件命中后取消剩余阶段。
8. 邮件按钮可以为正确账号的 Stripe Checkout 自动应用优惠，手动输入仍可用。
9. 充值和订阅购买项可以分别选择，其他支付渠道不能使用召回优惠。
10. Webhook 重放、任务重试和多节点并发不会重复发券或重复记录转化。
11. 暂停或取消后不再产生新发券或邮件，已发码保持到期前有效。
12. Flatkey 不执行本地折扣或赠送额度，最终付款金额由 Stripe 决定。

## 20. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 批量创建 Stripe 对象触发限流 | 小批次 worker、速率控制、429 指数退避、活动级并发上限 |
| Price 共用 Product 导致优惠范围过宽 | 激活前解析 Product 并阻止无法精确隔离的配置 |
| 多节点重复发券或发信 | 数据库唯一约束、租约、状态前置条件和 Stripe 幂等键 |
| 邮件外部结果不确定导致重复 | 不确定状态人工复核，不自动重发 |
| Webhook 丢失导致转化漏记 | Event ID 幂等处理加定期 Stripe 对账 |
| 邮件链接被转发 | claim 和 Promotion Code 同时绑定 Flatkey user 与 Stripe Customer |
| 邮件扫描器制造虚假点击 | 点击只记观察事件，付款才计收入转化 |
| 自动活动持续扩大成本 | 活动级入组上限、暂停开关、运行指标和错误率告警 |
| 用户已回流仍收到提醒 | 每个邮件阶段发送前重新检查付款、活跃和退订状态 |

## 21. 上线边界

功能应以默认关闭的运营入口上线。数据库迁移、后台管理、worker、Stripe Checkout 和 Webhook 归因需要作为一个一致版本部署；在功能入口关闭时不得创建活动或任务。

该功能会修改共享 Go 后端、Stripe 付款路径和数据库模型，因此生产发布时 console、router 和 legacy Go 服务应使用同一版本；网站服务不需要部署。具体部署操作不属于本设计阶段。

## 22. 参考资料

- Stripe Checkout discounts: https://docs.stripe.com/payments/checkout/discounts.md?payment-ui=stripe-hosted
- Stripe coupons: https://docs.stripe.com/billing/subscriptions/coupons.md
- Create a promotion code: https://docs.stripe.com/api/promotion_codes/create.md
- Create a coupon: https://docs.stripe.com/api/coupons/create.md
