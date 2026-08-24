# 套餐（Plan）模式技术开工文档

> 日期：2026-07-17 · 修订：2026-07-19（D9 拍板）· 基线：main@997beb4eb · 作者：growth/eng
> 产品方案与定价依据：`~/workspace/flatkey/reports/plan-pricing-proposal-2026-07-17.html`（定价 v1）→ **成本护栏与分档修订 `reports/plan-tier-limits-cost-guardrails-2026-07-18.html`（v3 为准）** + 产品 UI 稿 `reports/plan-subscription-product-ui-2026-07-18.html`
>
> **07-19 拍板（D9）：档位不区分模型。** 三档全模型统一（含 Opus），分档维度只有额度（三层窗口：Go $10/$22/$45 · Pro $18/$45/$90 · Max $60/$150/$300）与速度（RPM 10/30/60 · 并发 2/4/8 · Max 高峰优先）。成本安全靠**全局模型权重计量**（扣池额 = list × w；国模/flash/GPT-5=1.0、Gemini-Pro=1.2、Haiku=1.25、Sonnet=1.5、Opus=2.5）。老用户维持 credits 按量不变（双轨制，`subscription_first` 无订阅自动走钱包，已验证零改动）。本文原 G2「档位模型范围」设计**作废**，见修订后 G2。

## 0. TL;DR

**main 上已有一套完整的订阅系统**（plan/order/user_subscription + Stripe/Creem/epay/WaffoPancake 四网关 + 订阅优先-余额兜底的计费管线 + 周期重置任务 + console 管理页）。产品方案的大部分骨架**不用新写**。

真正的开发缺口只有四块：

| # | 缺口 | 规模 |
|---|---|---|
| G1 | **多层美元窗口**（5h 滚动 + 周），计数单位=**加权美元**（扣池前 amount×w） | 核心开发项 |
| G2 | ~~订阅的模型范围检查~~ → **全局模型权重表**（setting 级 {前缀→权重} 配置，全档共用；无 per-plan scope、无 Ability 收窄） | 小（07-19 缩水） |
| G3 | **视频/图积分独立池**（LLM 窗口与媒体积分分账) | 中 |
| G4 | **每档 RPM/并发风控**（per-user RPM 已有 per-group 配置；per-user 并发 cap 需新增）——D9 后升级为**档位核心差异化维度** | 小-中 |

其余（三档商品、首月半价、Stripe 订阅、余额溢出、购买 UI、过期/重置）= **配置 + 少量胶水**。

---

## 1. 现状盘点（探查结论，含代码坐标）

### 1.1 订阅系统（已有，直接复用）

- 数据模型 `model/subscription.go`：
  - `SubscriptionPlan`（:146）——价格/币种、时长（月/日/时/自定义秒）、`TotalAmount`（quota 池）、`QuotaResetPeriod`（never/daily/weekly/monthly/custom，:29-33 常量）、`UpgradeGroup`（购买后切用户组）、`StripePriceId`/`CreemProductId`、`MaxPurchasePerUser`、`AllowBalancePay`
  - `SubscriptionOrder`（:205）、`UserSubscription`（:244，`AmountTotal/AmountUsed`、`NextResetTime`、`PrevUserGroup`）
  - `PreConsumeUserSubscription`（:1091）——FOR UPDATE 行锁 + `SubscriptionPreConsumeRecord` requestId 幂等，多节点安全
  - `ResetDueSubscriptions`（:1221）/ `ExpireDueSubscriptions`（:944，过期回退用户组）
- 后台任务：`service/subscription_reset_task.go:29`（1 分钟 tick），注册于 `main.go:145`
- 计费管线接入 `service/billing_session.go` + `service/funding_source.go`：
  - `FundingSource` 接口（wallet / subscription 双实现），Settle 差额结算、Refund 幂等重试
  - **`BillingPreference` 用户偏好（billing_session.go:411-450）：`subscription_first`（默认）= 订阅扣完自动落钱包** —— 产品要的 "Use balance 溢出" 语义已实现
- 支付：`controller/subscription_payment_stripe.go:23`（Stripe subscription-mode Checkout，用 `StripePriceId`）、`subscription_payment_{creem,epay,waffo_pancake}.go`、余额购 `model/subscription.go:700`
- Console 前端：`web/default/src/features/subscriptions/`（admin 管理）、`features/wallet/components/subscription-plans-card.tsx`（用户购买）

### 1.2 计费/计量底座（窗口引擎的依赖）

- 成本计算：`relay/helper/price.go:50 ModelPriceHelper` → `types.PriceData`；结算 `service/text_quota.go:321 PostTextConsumeQuota` → `SettleBilling`（`service/billing.go:34`）
- **quota 单位即 list 价美元等值**（`common.QuotaPerUnit` 换算）→ 产品的"美元等值限额"直接用 quota units 计数，无需新汇率
- 每请求日志 `logs` 表（`model/log.go:131`，`idx_type_created_at_quota` 索引）；日粒度预聚合 `quota_data`（`model/usedata.go:14`）——可作窗口对账数据源，但无 5h 子日粒度
- 模型/渠道 gating：`Ability`（group,model,channel）`model/ability.go:20`；入口检查 `middleware/auth.go:409`（组权限）、`middleware/distributor.go:92`（token 模型白名单）
- 分组倍率：`setting/ratio_setting/group_ratio.go`（GroupRatio / GroupModelRatio 分组分模型覆盖）

### 1.3 限流/风控（已有）

- per-user 模型请求 RPM：`middleware/model-rate-limit.go:167`（Redis token-bucket Lua + 成功数 LIST 窗口），**按用户组覆盖配置** `setting/rate_limit.go:41 GetGroupRateLimit` → 每档 RPM 只是配置
- 并发：仅 per-channel（`service/channel_concurrency.go`，Redis ZSET lease）；**无 per-user 并发 cap**
- 风控：注册域名风控（`model/registration_domain_risk.go:84`，超阈自动封）、注册 IP 记录与奖励限频（`model/new_user_bonus.go`）、Stripe 卡指纹绑定与防重放（`controller/topup_stripe.go:1176`、`model/stripe_card.go:81 ClaimStripeCardFingerprint`）、邀请奖励首充后发（`model/invite_reward.go:109`）
- 中间件顺序（`router/relay-router.go:79-83`）：TokenAuth → ModelRequestRateLimit → Distribute → Relay

---

## 2. 差距与技术方案

### G1 多层美元窗口（5h 滚动 + 周；月 = 现有池）

现状：一个订阅一个池（`AmountTotal/AmountUsed`）+ 一个重置周期。方案要求同时满足 `$12/5h + $30/周 + $60/月` 三层。

设计：

- **月层**：直接用现有 `AmountTotal` + `QuotaResetPeriod=monthly`（零开发）。
- **周层 / 5h 层**：新增 plan 字段 `WindowWeekQuota`、`Window5hQuota`（bigint，quota units，0=不启用）。计数器放 **Redis**（多节点一致，Rule 11）：
  - 周窗（07-19 拍板：**按订阅起始锚定的 7 天周期**，非全网周一）：周期序号 `idx = floor((now - sub.start_time)/7d)`，key `sub:win:w:{subId}:{idx}`，`INCRBY` + 首次写入 `EXPIREAT` 周期末。与月池随账期重置（`NextResetTime`）同构，用户的「周」与账单日对齐；顺带避免全网周一同刷的请求洪峰。console 倒计时按 `sub.start_time` 推算。
  - 5h 窗：滚动窗口，用**分桶近似**——30 分钟一桶共 10 桶，key `sub:win:5h:{subId}:{bucketTs}`，`INCRBY` + `EXPIRE 5.5h`，检查时 `MGET` 求和。避免 ZSET per-request 成员膨胀（参考 `common/limiter` 的 Lua 模式，新增一个 `window_limit.lua` 原子化"读和+判断+加"）。
  - **挂载点**：`SubscriptionFunding.PreConsume`（`service/funding_source.go:86`）内、`model.PreConsumeUserSubscription` 调用之前检查两层窗口；超窗返回专用错误码（新增 `ErrorCodeSubscriptionWindowExceeded`），`billing_session.go` 的 `subscription_first` 分支把该错误视同 quota 不足 → **自动落钱包**（溢出语义免费获得）。
  - Settle/Refund 差额同步回写窗口计数（负数用 `DECRBY`，容忍轻微漂移）。
  - **对账兜底**：Redis 丢数据时窗口计数自动偏松（计数丢失=放行），可接受——月池仍是硬闸；每日可用 `logs` 表 SQL 抽查窗口计数偏差。
- 错误文案走后端 i18n（en/zh-CN/zh-TW/pt 四文件，CLAUDE.md i18n 规则），提示"窗口刷新时间 + 可用余额兜底"。

### G2 全局模型权重计量（07-19 修订，替代原「档位模型范围」）

拍板 D9：档位不区分模型，原两层 gating（Ability 收窄 + per-plan ModelScope）**全部不做**。plan 表不加模型字段；`plan-go/pro/max` 用户组只承载 RPM/并发差异（G4），模型能力与 default 全等（`Ability` 不动，升档/退订都不会断已有 token）。

替代设计——**全局权重表**：

- `setting/` 新增 `subscription_model_weights`（ConfigManager，JSON `{前缀: 权重}`，最长前缀匹配，缺省 1.0）。数值见护栏报告 D6：国模/flash/GPT-5=1.0、Gemini-Pro=1.2、Haiku=1.25、Sonnet=1.5、Opus=2.5。运营可改，不发版。
- 挂载点：`SubscriptionFunding.PreConsume`/`Settle` 中 `amount × w` 后再进池与三层窗口计数（G1 的 Redis 计数器与月池 `AmountUsed` 记的都是加权额）。Refund 按同权重回写。
- 溢出钱包部分**不加权**（list 原价按量，与老用户口径一致）。
- 日志：`logs.other` 里补 `plan_weight` 字段，供 utilization 对账与前端展示「本次扣池 $x（×1.5）」。

### G3 视频/图积分独立池

设计（最小改动）：复用订阅实例机制——plan 新增 `MediaCreditAmount`（quota units，月发）；`UserSubscription` 增 `MediaTotal/MediaUsed`，随月重置一并刷新（`maybeResetUserSubscriptionWithPlanTx`，subscription.go:1055 处扩展）。计费侧：task 类 relay（视频/图，`relay/channel/task/*`、gpt-image 等）在 funding 选择时优先烧 media 池、不足落钱包，**不烧 LLM 窗口**。模型属于"媒体"用 `ModelScope` 同款前缀表达（`MediaModelScope`）。积分 90 天滚存暂不做（v1 月清，UI 稿口径待改或产品确认）。

### G4 每档 RPM / 并发

- RPM：`ModelRequestRateLimitGroup` 已支持按组配置（`setting/rate_limit.go`）→ 给 `plan-go/pro/max` 三组配不同 RPM，纯运营配置。
- 并发：新增 per-user in-flight cap，抄 `service/channel_concurrency.go` 的 Redis ZSET lease 实现，keyed by userId，上限从用户组配置读；挂在 `Distribute` 之前。v1 可只对 plan 组启用。

### 风控联动（配置为主）

- 订阅购买本身就是付费行为（webhook 成功才 `CreateUserSubscriptionFromPlanTx`）→ "付费才激活"天然满足；首月 $5 = Stripe 首期折扣 coupon/phase 定价，配置侧完成。
- 复用：卡指纹 claim 防一卡多号（`ClaimStripeCardFingerprint`）、注册域名风控、邀请奖励首充后发的既有模式。
- Max 档灰度：`MaxPurchasePerUser` + `Enabled` 开关；邀请制 v1 用"不上架 + 后台 admin source 手动开通"（`UserSubscription.Source=admin` 已支持）。

---

## 3. 里程碑（每步带验证）

| 周 | 交付 | 验证标准 |
|---|---|---|
| W1 | **配置跑通现有链路**：staging 建三档 plan（Stripe Price/首月券）+ 三个 plan 组 + abilities + 组 RPM；不动代码 | staging 走通 购买→订阅扣费→溢出落钱包→月重置→过期回组 全链路（`subscription_first` 默认） |
| W2 | **G1 窗口引擎（加权计量）+ G2 全局权重表**（后端 PR，含 i18n 四语言 + 单测：分桶求和、周一刷新、权重扣池/Settle 回写、幂等） | 集测：打满 5h 窗 → 429/落钱包；Opus 请求按 ×2.5 扣窗；周窗跨周一刷新；多节点（两实例并发打）计数不超卖 |
| W3 | **G3 媒体池 + G4 并发 cap** + console 展示（窗口余量/重置倒计时，wallet 卡片扩展） | 视频请求烧 media 池不动 LLM 窗；并发超限 429 |
| W4 | **website pricing 页**（`website/`，按 `reports/pricing-page-ui-v1.html` 稿，Rule 9：只改 Next.js 站）+ 灰度：上架 Go+Pro，Max admin 手开 | 线上购买转化埋点（沿用 topup-tracking 模式）；utilization 周报（logs 表 SQL） |

上线后：每两周按实测 utilization 复盘窗口数值（产品报告 §5），**只调限额不调价**。

## 4. 多节点与部署（Rule 11 / Rule 12）

- 窗口计数、并发 lease 全走 Redis 原子操作（Lua/INCR）；订阅扣费依赖现有行锁+幂等记录，无进程内状态。Reset 任务已是幂等 SQL（多实例重复跑安全，:1058 时间闸）。
- **Router deploy: required**——G1/G2/G3 改动 `service/billing_session.go`、`funding_source.go`、relay 计费路径。Console 同步部署（订阅 UI 扩展）；website 独立 workflow（`gcp-deploy-website.yml`）。
- DB 迁移：plan/user_subscription 加列均为 ADD COLUMN（SQLite 兼容，Rule 2）。

## 5. 开放问题（开工前拍板）

已拍板（07-18/19，详见护栏报告 v3 §7）：

- **D9 ✓ 档位=额度+速度，模型不区分**；Go 月池 6x→4.5x（$45）。原 D1 软/硬锁之争注销。
- **D6** 权重表：国模/flash/GPT-5=1.0、Gemini-Pro=1.2、Haiku=1.25、Sonnet=1.5、Opus=2.5（全局一张表，配置化两周可调）。
- **D2** plan 组费率（GroupRatio）与 default 完全一致——溢出单价与老用户相同。

- **周窗口径 ✓（07-19）：按订阅起始锚定 7 天周期**（见 G1 设计），与月池账期重置同构。
- **充值 bonus ✓（07-19）：随套餐上线整体下线**。不是下调，是去掉——数据：近 30 天 bonus 送出 $105/收款 $340（30.9%），全烧 Claude（0.8）结构性亏；与套餐双优惠并存口径混乱；下线后 A4 攻击面（bonus 余额承接溢出）消除。已发放 bonus 余额不追回；topup UI/落地页/website PAYG tab 同批改原价口径；邀请奖励（首充后发 $10/$10）是独立体系，保留不动。

待拍板：

1. 视频积分 90 天滚存：v1 不做（月清），UI 稿文案改"monthly, resets with plan"？
2. 5h 窗分桶粒度 30min（±10% 误差）可接受？（对齐产品"体验优先"，误差偏松不偏紧）
3. Max「高峰优先路由」v1 是否实现（渠道选择加权/队列优先）还是先只做 RPM/并发差异、优先级 v2 再上？**建议 v1 只做 RPM/并发，宣传页写 priority access 但按灰度邀请制兑现**→ 若写上页面就必须实现，需产品定。

## 附：本次探查的完整代码地图

三份detail map（计费管线 / 支付与订阅 / 限流风控）见本文档同批产出的探查记录；关键坐标已内联于 §1。
