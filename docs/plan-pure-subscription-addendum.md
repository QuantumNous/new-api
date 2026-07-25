# 纯套餐模式 · 定稿附录（2026-07-19）

> 修订自 `plan-subscription-tech-kickoff.md`（v3）。本附录为**产品口径定稿**：
> 双轨制 → **纯套餐**。配套可视化：`~/workspace/flatkey/reports/plan-pure-subscription-2026-07-19.html`。

## 0. 口径变化

- **旧（双轨制）**：老用户维持 credits 按量，套餐是新增可选轨。
- **新（纯套餐）**：人人套餐范式。充值余额从「主计费方式」降级为「套餐额度用完后的加油包」（实时按量、list 原价、不加权、不受窗口限制）。
- 老用户零迁移：现有余额天然继续可用（即加油包），谁都可随时买套餐。「迁移方案」这个问题不存在了。

## 1. 用户生命周期

```
新用户注册（风控通过后）
  → 自动获得 Free 套餐（$1 等值 · 全模型 · 1 个月 · 一次性不刷新）
  → 用套餐额度（三层窗口 + 模型权重计量）
  → 额度用完 / 到期：
      A. 升级更高档（Go/Pro/Max）
      B. 充值余额 → 实时按量计费（现有引擎已实现：订阅不足自动落钱包）
```

三种「用完」（Free 烧完 / Free 到期 / 付费档打满）汇到同一出口 = 已验收的兜底引擎。

## 2. 档位（v4：Free + 三付费档，全档全模型）

| 档 | 价格 | 窗口（加权美元） | 速度 | 备注 |
|---|---|---|---|---|
| **Free** | $0 | 月池 **$1**（无 5h/周窗） | 与 Go 同 RPM 配置 | 注册自动发 · 1 个月 · 一次性 · 不上架购买列表 |
| Go | $10（首月 $5） | $10/5h · $22/周 · $45/月 (4.5x) | 10 RPM · 2 并发 | |
| Pro | $30 | $18/5h · $45/周 · $90/月 (3x) | 30 RPM · 4 并发 | media 积分 |
| Max | $100 | $60/5h · $150/周 · $300/月 (3x) | 60 RPM · 8 并发 · 高峰优先 | 邀请制灰度 |

全档全模型（D9），全局权重表（D6：国模/flash/GPT-5=1.0、Gemini-Pro=1.2、Haiku=1.25、Sonnet=1.5、Opus=2.5）。Free 的 $1 池在权重下调 Opus 实得 ≈$0.4 list——天然防白嫖旗舰，Free 无需单设模型范围。

## 3. Free 档实现（`model/free_plan.go`，已提交）

- `EnsureFreePlanSeed()`：懒加载幂等建 Free plan（title="Free" 固定标识；`enabled=false` 不进购买列表；`MaxPurchasePerUser=1`；`quota_reset_period=never`）。不改 main.go 启动流程。
  - 注意 gorm 坑：`Enabled` 列带 `default:true`，Create 零值被默认值覆盖，需建后显式 `Update("enabled", false)`（已处理 + 单测覆盖）。
- `GrantFreePlanToUser(userId)`：幂等发放（复用 `CreateUserSubscriptionFromPlanTx` + MaxPurchasePerUser=1 硬闸，重复发放视为成功）。
- **调用方约定：必须在注册风控（域名/IP/邮箱）之后调用**。风险注册不发放——Free 是 farm 主战场，单号最坏敞口 $1 list（Opus 路径 ≈$0.4 成本），比历史 $706/号小三个数量级，但规模化仍要靠风控前置。
- 单测：`model/free_plan_test.go`（seed 幂等 / 发放幂等 / enabled=false / never-reset）。

## 4. 改造清单与状态（2026-07-19）

| 部分 | 状态 |
|---|---|
| 后端计费引擎（三层窗口 + 权重 + 用完落余额） | ✅ 已提交并本地端到端验收 10/10（`scripts/verify_plan_engine.sh`） |
| Free 档 seed + 发放函数 | ✅ 已提交（本附录同批） |
| 注册钩子（风控通过后调 `GrantFreePlanToUser`） | ⏳ 待接线（需梳理全部注册入口：邮箱/OAuth/passkey） |
| console admin 建套餐表单（窗口字段）+ 权重表设置 UI | ⏳ 待做 |
| console 用户侧：套餐用完「升档 + 充值」双 CTA、钱包页窗口余量/倒计时 | ⏳ 待做 |
| website 定价页（四档 + 加油包口径） | 📄 方案（Rule 9，`website/`） |

**合并安全性**：窗口列默认 0、权重表默认空、Free 未接注册钩子——合并不改变现网行为，配置/接线后逐步生效。Router deploy required。
