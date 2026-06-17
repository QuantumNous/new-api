# PRD — 自动充值 + 充值引导（Auto-recharge & Top-up Guidance）

> 目标：打通"注册 → 引导充值 → 自动续费"的变现闭环，并修复自动充值按成本价亏卖的定价 bug。

---

## 0. 版本变更

### v0.1（2026-06-16，已上线）
- 修复自动充值定价 bug（成本价 → 售价 ×5，最低 $5 USD）
- 用户自助设置自动充值（钱包卡片，默认开启）
- 控制台首页低余额充值引导卡（新用户引导）
- Airwallex 充值处提示"仅单次，自动充值请用 Stripe"

涉及 commit：`416daf30`（自动充值）、`096f7f33`（Airwallex 提示）、`007b4159`（充值引导卡）。

---

## 1. 背景

### 1.1 现状（v0.1 前）
- 平台支付通道已配好：手动充值走 Stripe / Airwallex（AUD），毛利约 80%。
- 代码里**已有**自动充值能力（`service/auto_topup.go`，挂在 `PostTextConsumeQuota` 后），但：
  1. **没有任何用户自助入口** —— 开关只在管理员后台的用户编辑抽屉里，普通用户开不了。
  2. **新注册用户没有被引导去充值** —— 注册只送 20000 试用额度（≈ $0.04），基本不够用，但用户登录后没有任何提示。

### 1.2 关键问题：自动充值按成本价亏卖
`decideAutoTopup` 用 `quotaUnitsToStripeCents` 计算扣款额：

```
扣款 = (AutoTopupAmount ÷ QuotaPerUnit) × 100 分
```

`QuotaPerUnit = 500000` 是 new-api 内部"500000 quota = $1 **成本**"的约定。该函数**只算 quota 的成本值，完全没乘售价倍率**（手动充值的 `StripeUnitPrice` = 8 AUD/单位）。

| | 用户实付 | 得到额度 | 毛利 |
|---|---|---|---|
| 手动充值 | 8 AUD（≈$5.3）| 500000 quota | ~80% ✅ |
| 自动充值（修复前）| **$1 USD** | 500000 quota | ≈ 0，甚至亏（含 Stripe 手续费）❌ |

→ 自动充值越推广，亏得越多，与"赚钱"目标相反。**必须先修，再推广。**

### 1.3 产品洞察
- **洞察 1**：自动充值是留存/ARPU 利器，但前提是"不亏卖"——它必须和手动充值同利润逻辑。
- **洞察 2**：自动充值天然只能用"已保存的卡"做免密扣款，所以它**依赖一次手动 Stripe 充值**（保存卡 + SCA 授权）。Airwallex 不支持免密扣款 → 用户需被明确告知"想自动续费用 Stripe"。
- **洞察 3**：新用户最大的流失点是"注册了但不知道下一步" —— 试用额度太小，需要一个**显眼但不强迫**的充值引导。

---

## 2. 目标

| 目标 | 衡量 |
|---|---|
| 自动充值不再亏卖 | 自动扣款额 = 手动同价（售价，非成本）|
| 用户能自助开自动充值 | 钱包页有开关 + 金额设置 |
| 默认鼓励开启 | 开关默认 ON + 明确告知 |
| 新用户被引导充值 | 低余额时控制台显示充值引导卡 |
| 不误导用户 | Airwallex 处说明它不支持自动充值 |

---

## 3. 功能设计

### 3.1 定价修复（`service/auto_topup.go`）
- 引入常量 `autoTopupSellMultiplier = 5`：每 $1 成本的 quota 按 **$5 USD 售价**扣款（≈ 8 AUD 手动价，5 倍加价）。
- 扣款额 = `quotaUnitsToStripeCents(amount) × 5`。
- 平台最低自动充值额提到 **$5.00 USD**（500 分）。
- 扣款币种保持 USD（`Currency: "usd"`，已有）。
- 倍率为常量，**后续可改为运营可配置项**。

### 3.2 单位经济（USD）
- **$5 USD = 1 单位 = 500000 quota = 用户 $1 的模型用量**（5 倍加价）。
- 前端金额预设（用户实付 USD）：`$5(最低) · $10(默认) · $20 · $100 · $1000`。
- 换算：`AutoTopupAmount(quota) = 选择的USD × 100000`。

### 3.3 用户自助接口（`controller/user.go` + `model/user.go`）
- `UpdateSelf`（`PUT /api/user/self`）新增分支，接受 `auto_topup_enabled / auto_topup_threshold / auto_topup_amount`。
- `model.User.UpdateAutoTopup()` 用 **map 更新**（非 struct）持久化三个字段 —— 否则"关闭"(enabled=false 零值) 会被 GORM `Updates` 跳过、关不掉。
- 校验：金额非负、上限 ≈ $1000（`amount ≤ 100000000` quota）防滥用。

### 3.4 钱包自助卡片（`features/wallet/components/auto-topup-card.tsx`）
- 开关 **默认 ON**（`auto_topup_enabled ?? true`）。
- 金额预设按钮（$5/10/20/100/1000，默认 $10）。
- 触发阈值 = 金额对应的 quota（余额低于"一次自动充值的量"时触发）。
- 文案明确告知："余额不足时自动从已保存的卡扣款，服务不中断，可随时关闭。"
- 未存卡时提示："先用银行卡手动充值一次以保存卡片。"

### 3.5 充值引导卡（`features/dashboard/components/topup-nudge.tsx`）
- 控制台首页顶部，余额 < `LOW_BALANCE_QUOTA(500000，≈$1用量)` 时显示。
- 新用户(20000 试用额度)天然命中。
- 文案："余额不足 — 充值即可开始使用" + [立即充值] → `/wallet`。
- 可手动关闭（dismiss），余额充足后自动消失。

### 3.6 Airwallex 提示（`features/wallet/components/recharge-form-card.tsx`）
- Airwallex 充值选项下方橙色提示："Airwallex 仅支持单次充值。如需开启自动充值，请改用 Stripe。"

---

## 4. 约束与限制
1. **仅 Stripe 支持自动充值**：Airwallex 不支持免密 off-session 扣款。用户必须先用 Stripe 手动充一次（存卡）。
2. **"默认开启"是 UI 层默认**：开关预设为 ON，但只有在用户保存 + 有已存卡时才会真正扣款（合规：首次 Stripe checkout 已带 SCA 授权 `SetupFutureUsage=off_session`）。新用户注册时 DB 默认仍为 false。
3. **端到端未实测**：与手动支付一样，自动扣款链路（存卡 → off-session 扣款 → 到账）需用真卡跑一次 Stripe 充值验证。

---

## 5. 未来工作（Open）
- [ ] 将 `autoTopupSellMultiplier` / 最低额 / 预设档变为运营后台可配置项。
- [ ] 评估为 Airwallex 实现免密/recurring 扣款（MIT），让自动充值不绑定 Stripe。
- [ ] 首次 Stripe 充值成功后弹窗主动提示"已为你开启自动充值"（更强引导）。
- [ ] 充值引导卡 A/B 文案与触发阈值调优。
- [ ] 真卡端到端验证：到账 + 存卡 + 自动扣款。
