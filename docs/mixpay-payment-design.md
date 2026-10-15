# MixPay 支付设计与开发规范

日期：2026-10-14。项目：new-api（QuantumNous）。基线 `12e19df4f`，对应当前仓库最新发布版 `v1.0.0-hcai(rc41f3)`。代码已实现，默认关闭；验证结果和上线剩余条件见 [验收记录](mixpay-payment-acceptance.md)。

## 1. 范围与业务决策

- 支持钱包余额充值、一次性付款购买订阅套餐；订阅权益使用下单时冻结的套餐。自动周期扣款不在本版范围。
- Go 服务端直接调用 MixPay API，浏览器打开官方托管收银台，不需要 SDK。
- 使用 USD 报价。钱包沿用本站充值定价、折扣及汇率规则；套餐沿用 `SubscriptionPriceUSD`。最终报价保留两位小数，充值额度独立冻结。
- 只有服务端核验 `data.status=success` 且 trace、payee、报价币种和报价金额全部匹配后，才发放余额或订阅。
- 不等待结算完成才履约；单独记录 `settleStatus` 并继续查单。商户需要接受支付成功到结算完成之间的上游结算风险。
- 不实现自动退款、提现、自建链上收款地址。这些需要独立的资金出口、地址和授权设计，不能从收单接口推导。
- 当前公开文档没有商户主动关单 API。关闭弹窗、本地超时、用户离开均不等于上游关单，服务端拒绝 MixPay cancel action。

## 2. 官方协议依据

| 能力 | 协议及来源 |
| --- | --- |
| 创建 | `POST https://api.mixpay.me/v1/one_time_payment` → `data.code`；[One Time Payment](https://mixpay.me/developers/api/payments/one-time-payment) |
| 收银台 | `https://mixpay.me/code/{code}`，短码受字符和长度限制 |
| 查询 | `GET https://api.mixpay.me/v1/payments_result?traceId=…`；[Payment Result](https://mixpay.me/developers/api/payments/payments-results) |
| 生命周期 | 只有 success / failed 是上游终态；足额付款识别后，确认可能跨越付款期限；[Lifecycle](https://mixpay.me/developers/api/payments/payment-lifecycle) |
| 通知 | 通知携带标识，服务端另行查单；HTTP 200 + `{"code":"SUCCESS"}`；[Callback](https://mixpay.me/developers/api/payments/payment-callback) |
| 来源 | 文档当前列出 `52.198.117.57`；[Security Guidelines](https://mixpay.me/developers/guides/security-guidelines) |
| 限流 | 文档标称全部 API 每分钟 60 次，维度未明确；[Rate Limiting](https://mixpay.me/developers/api/rate-limiting) |
| 协议变更 | [Change Log](https://mixpay.me/developers/api/change-log) |

文档差异：Change Log 的回调上限是 9 次，旧 Callback 页面仍写 10 次；实现不依赖该次数。`isTemp` 已移除，代码不发送。Change Log 提到幂等短码与 `data.info`，详细契约仍需商户联调确认。当前无公开回调签名算法，不声称“已验签”；依据为来源限制、受 TLS 保护的官方查单与本地冻结订单绑定。

创建请求仅发送一次。发送前持久化 `creation_state=uncertain`，收到短码才改成 ready。响应丢失或崩溃后只查询原 trace，不盲目重建；因此可能出现没有短码、长期待核实的订单。自动恢复短码必须等待官方幂等契约验证。查询不存在和网络错误都不是关单证据。

## 3. 数据与事务

新增 `MixPayConfig`、`MixPayOrder`、`MixPayRequestBudget`，不改变已有支付表字段。每次设置保存产生配置版本；历史订单保存原收款人、结算资产、严格模式、回调与返回地址。关闭新单入口不停止历史单核验。

创建事务同时保存 `TopUp` 或 `SubscriptionOrder` 以及 MixPayOrder：

- `trade_no`、`trace_id` 唯一；`(user_id, request_key)` 唯一。同 key 同输入恢复原订单，不同输入拒绝。
- 保存 `requested_amount`、`plan_id`、精确 `quote_amount`、`quote_asset_id=usd` 和 `credited_quota`；报价和额度是审计依据。旧 `Money float64` 仅用于兼容展示。
- 订阅完整套餐 JSON 存在业务订单 `ProviderPayload`，不在支付完成时读取已修改的套餐权益。
- 每用户最多 10 个 pending / paid 订单。订阅沿用现有同套餐/同等级购买限制及未完成订单预留。
- 订单保存 lease token、lease until、wake version、retry、next check、review、cache/log pending。

付款证据与履约分两步持久化。验证成功先保存 paid；余额容量不足或数据库履约失败保留付款证据。履约锁顺序为用户 → MixPay 订单 → 业务订单，与订阅购买用户锁一致。状态、余额或订阅发放、支付凭据和副作用标记在同一个事务提交。success 订单重复处理不再发放。

钱包额度调用 `creditTopUpQuota`，使用已有共享累计 credit sequence 同步缓存，不能简单重放 Redis INCR。订阅提交后刷新用户组缓存。日志单独写入已有日志封装，支持独立日志库；主库订单才是财务防重依据。日志采用至少一次投递，稳定 RequestId 为 `mixpay:{trade_no}`，不保证日志物理去重。

普通手动补单及通用订阅完成/过期接口禁止处理 MixPay；管理员只能排队查单和恢复，不能指定到账额度或伪造成功。

## 4. 接口

| 路径 | 行为 |
| --- | --- |
| `GET /api/option/mixpay` | 管理配置读取 |
| `PUT /api/option/mixpay` | root 会话、Origin 检查、限流、一次性二次验证 proof；绑定完整请求 JSON 的 SHA-256；版本冲突拒绝 |
| `POST /api/user/mixpay/amount` | 登录后报价，返回 USD 金额字符串；可提供 plan_id 查询套餐 |
| `POST /api/user/mixpay/pay` | 钱包创建；amount、expected_amount、request_key；服务端重新报价 |
| `POST /api/subscription/mixpay/pay` | 套餐创建，plan_id 必须大于 0 |
| `GET /api/user/mixpay/order/:trade_no` | 仅所属用户查询本站状态 |
| `POST /api/user/mixpay/notify` | 无登录回调；来源和订单标识校验后持久化唤醒再 ACK |
| 已有个人订单 pay action | 恢复原订单，不换 trace、不延长期限；cancel 拒绝 |
| 已有后台订单 recheck/recover | root 限制和既有审计；只唤醒统一核验队列 |

金额不取信浏览器；expected_amount 仅用于发现报价变化。支付链接只由官方短码生成；前端再次限制完整 HTTPS 域名与路径。浏览器返回页面不会触发入账。

## 5. 状态与调度

| 状态 | 本站行为 |
| --- | --- |
| unpaid / confirming / pending / auditing | 等待官方最终结果，不发放 |
| paid_less | 提示不足，可在有效期内返回原收银台补足 |
| success | 保存 paid 证据，事务履约；本地 success 后刷新余额或订阅 |
| failed | 身份核验后失败，不宣称已退款 |
| 接口错误 / 未知状态 | 保留已知事实并重试 |
| 冲突终态 / 身份不匹配 | review_required，禁止自动发放 |
| 订阅购买冲突 | 业务订单 paid_review，保留付款凭据，不自动退款或发放 |

默认有效期 900 秒，可配置 60–86400 秒；只隐藏过期支付入口，不把已发往 MixPay 的订单改成失败。只有确定尚未发起的 queued 订单才能本地拒绝。原订单仍可在历史中查询。

已有系统任务每 2 秒尝试处理最多 10 个到期订单。创建和查询共享数据库预算（最少间隔 1500ms，即持续最多 40 次/分钟）；429 / 1429 暂停一分钟。订单使用 60 秒租约，网络超时 12 秒，不持有数据库事务等待 HTTP。响应提交验证租约 token 和时效；wake version 避免查单结束覆盖并发通知。失败指数退避至 300 秒，超过一小时的订单低频查询。

成功已结算且缓存/日志均完成，或官方失败且无待恢复副作用时停止定时查询。停用配置不停止队列。多个独立部署共用商户或出口时，各自数据库预算不能保证全局限流，运维需统一调度或分配预算。

## 6. 安全与前端复用

- 固定 API 主机、系统 TLS 校验、禁止重定向、响应最多 64KiB；请求体和标识有长度限制。
- 十进制正数、精度与范围校验；USD 报价最高 1,000,000，额度使用已有严格整数转换及钱包上限。
- 通知当前严格允许官方文档 IP；必须正确配置应用 TRUSTED_PROXIES，不能允许公网任意伪造转发头。IP 名单更新需随官方公告维护。
- 回调只唤醒，不能直接改为 paid；回调丢失依赖后台补单恢复。
- 配置更改复用现有 root 二次验证，禁止 access token；proof 绑定请求体、用户与会话，单次使用。操作日志不保存 proof 或请求体。
- 七语言文案；钱包、订阅和订单恢复共用 MixPayDialog。该组件组合已有 Dialog、CopyButton、Button。现有微信 QR 弹窗依赖 QR 且到期终止其付款展示，不适合直接套用 MixPay 的外部收银台及跨期限确认语义；没有新增通用弹窗或复制组件。
- 设置复用 Form、Input、Switch 和 SecureVerificationDialog；没有自建验证流程。

本次安全核对采用 OWASP Authentication、Session Management、Transaction Authorization、CSRF Cheat Sheets；ASVS 最新稳定版本为 5.0.0（排除 rolling latest）。本次为支付配置接入现有认证框架，不宣称整站满足 ASVS。适用重点为敏感操作重新验证、会话绑定、一次性 proof、防重放、服务端权限及 Origin 防护；实际测试和未验证部分见验收记录。

## 7. 上线和运维

保持默认关闭，完成商户小额真实收款、到账与结算核对后再启用。上线前必须确认账户/资产、通知 IP、代理边界、真实错误码和创建恢复行为。

后台已有系统任务失败记录、订单重试和人工核验信息；尚未接入外部告警通道。应对 paid 长时间未履约、success 未结算、长期 uncertain、审核积压和持续限流设置告警及责任人。退款和订阅冲突由财务人工核实，不能把审核标记清除当作资金处理。

回滚应保留 MixPay 表及能够核验在途单的 worker；仅停用新单不能删除历史配置或停掉所有补单。真实资金联调与生产启用不包含在本次本地开发操作中。
