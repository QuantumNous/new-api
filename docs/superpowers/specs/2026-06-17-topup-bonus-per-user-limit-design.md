# 充值赠送「每用户每档位限领次数」设计

- 日期：2026-06-17
- 分支：`feature/topup-amount-bonus`
- 状态：设计已确认，待实现

## 背景

项目已实现「充值送额度」（top-up deposit bonus）：管理员在支付设置里配置 `AmountBonus map[int]int64`（档位金额 → 赠送额度），用户充到对应档位即获赠。

当前实现把赠送在**下单时**就固化进订单 `Amount`：`configuredTopUpAmounts(req.Amount)` 返回 `本金 + 赠送`，回调入账时无脑 `quota += Amount × QuotaPerUnit`，回调侧不区分本金/赠送。

**缺口**：同一用户可对同一档位无限次充值、每次都拿赠送，没有任何「每用户限领次数」约束，存在被反复薅赠送的运营敞口。

## 目标

为每个赠送档位增加「**该档位每个用户最多享受几次赠送**」配置。

### 已确认的需求边界

| 维度 | 决策 |
|------|------|
| 限次周期 | **永久累计**（终身 N 次）。按月/按活动重置留待后续迭代 |
| 计次时机 | **支付成功回调入账时** +1。下单不付款不占次数 |
| 超限处理 | **照常充值**：收款照旧、本金额度照到，仅不发赠送部分 |
| 实现路径 | **回调时判次 + 补赠送**：送/不送决策内聚在入账事务，用唯一索引原子防并发刷 |
| 计次方式 | 插入「第 N 次」claim 行（审计式），非维护 count 字段 |
| 档位标识 | 直接用充值金额数字（如 `20`）作 tier |

### 非目标（本次不做）

- 按月 / 按日 / 按活动周期重置（仅做永久累计）
- 充值退款扣回额度（已确认不在本次范围）
- 跨档位共享次数（每档位独立计次）
- **TOKENS 展示模式**：本功能（赠送 + 限次）仅支持 USD/CNY 展示模式。TOKENS 模式下 `req.Amount` 是 token 数，与按金额配置的 `AmountBonus`/`AmountBonusLimit` 的 key 量纲不匹配，赠送与限次均不生效（与既有 AmountBonus 行为一致）。
- **Creem 渠道**：Creem 走 productId→quota 模型，不属于「充 X 送 Y 档位」体系，不参与赠送/限次。

## 核心矛盾与解法

**矛盾**：现状「下单时固化赠送进 Amount」与需求「支付成功才判次决定送不送」冲突——回调侧必须能独立决策赠送，但现在它只看到一个含赠送的总额。

**解法**：把赠送决策从下单侧挪到回调侧。

- 下单侧：`Amount` 改回**只存本金**，`BonusAmount` 存**潜在可赠额**（候选值，未必发放）。
- 回调侧：在现有 `FOR UPDATE` 事务内，本金照入账后，再原子判断「该用户该档位是否还有领取额度」，是→把赠送加进 quota 并占用一次 claim，否→只发本金。

## 详细设计

### 1. 配置结构（向后兼容）

`setting/operation_setting/payment_setting.go`：

```go
type PaymentSetting struct {
    AmountOptions    []int           `json:"amount_options"`
    AmountBonus      map[int]int64   `json:"amount_bonus"`       // 档位 → 赠送额（不变）
    AmountBonusLimit map[int]int     `json:"amount_bonus_limit"` // 档位 → 每用户终身可享次数；缺省/0 = 不限次
    AmountDiscount   map[int]float64 `json:"amount_discount"`
    // ... 其余不变
}
```

用并列 map 而非把 `AmountBonus` 改成结构体，理由：不破坏存量 `amount_bonus` 配置 JSON、不动现有校验路径。缺失或值为 0 表示该档位不限次（保持现有行为）。

### 2. 计次表

新增 `model/topup_bonus_claim.go`：

```go
type TopUpBonusClaim struct {
    Id          int    `json:"id" gorm:"primaryKey"`
    UserId      int    `json:"user_id" gorm:"uniqueIndex:idx_topup_bonus_user_tier_seq"`
    Tier        int    `json:"tier" gorm:"uniqueIndex:idx_topup_bonus_user_tier_seq"`
    Seq         int    `json:"seq" gorm:"uniqueIndex:idx_topup_bonus_user_tier_seq"`
    TradeNo     string `json:"trade_no" gorm:"type:varchar(255);index"`
    BonusAmount int64  `json:"bonus_amount"`
    CreatedTime int64  `json:"created_time" gorm:"bigint"`
}
```

`(UserId, Tier, Seq)` 联合唯一索引是并发防刷的核心。

### 3. 原子判次 + 计次函数

在 `model/topup_bonus_claim.go`，要求在调用方的事务内执行：

```go
// claimTopUpBonus 尝试为 (userId, tier) 占用一次赠送名额。
// limit<=0 表示不限次。返回 true 表示本次应发放赠送。
// 并发竞争由 (UserId,Tier,Seq) 唯一索引裁决：同时插入相同 Seq 时只有一笔成功。
func claimTopUpBonus(tx *gorm.DB, userId, tier int, bonusAmount int64, limit int, tradeNo string) (bool, error) {
    used := int64(0)
    if err := tx.Model(&TopUpBonusClaim{}).
        Where("user_id = ? AND tier = ?", userId, tier).Count(&used).Error; err != nil {
        return false, err
    }
    if limit > 0 && used >= int64(limit) {
        return false, nil // 已达上限
    }
    claim := &TopUpBonusClaim{
        UserId: userId, Tier: tier, Seq: int(used) + 1,
        BonusAmount: bonusAmount, TradeNo: tradeNo, CreatedTime: common.GetTimestamp(),
    }
    res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
    if res.Error != nil {
        return false, res.Error
    }
    return res.RowsAffected > 0, nil // 冲突=并发竞争输了，不发
}
```

### 4. 下单侧改动

`controller/topup.go` 的 `configuredTopUpAmounts`：

```go
// 改动前：返回 (本金+赠送, 赠送)
// 改动后：返回 (本金, 潜在可赠额)；Amount 不再含赠送
func configuredTopUpAmounts(requestAmount int64) (int64, int64) {
    amount := normalizeTopUpAmount(requestAmount)
    bonus := configuredTopUpBonusAmount(requestAmount)
    return amount, bonus // 不再相加
}
```

订单落库：`Amount = 本金`，`BonusAmount = 潜在可赠额`，新增持久化 `tier = 原始 req.Amount`（用于回调反查 limit）。各渠道下单处（epay/stripe/paddle/waffo/waffo_pancake）同步带上 tier。

> 注：tier 需要在订单上持久化，否则回调侧无法还原「这是哪个档位」。在 `TopUp` 增加 `BonusTier int` 字段，或复用既有可推断字段。倾向新增显式字段，避免歧义。

### 5. 回调侧改动（6 个入账路径统一）

入账函数：`Recharge` / `ManualCompleteTopUp` / `RechargeCreem` / `RechargeWaffo` / `RechargeWaffoPancake` / `RechargePaddle`。

抽公共 helper，在现有 `FOR UPDATE` 事务内、本金 `quotaToAdd` 算好之后插入：

```go
// 本金照入账
quotaToAdd = int(Amount × QuotaPerUnit)
// 判赠送
if topUp.BonusAmount > 0 {
    limit := operation_setting.GetPaymentSetting().AmountBonusLimit[topUp.BonusTier]
    granted, err := claimTopUpBonus(tx, topUp.UserId, topUp.BonusTier, topUp.BonusAmount, limit, topUp.TradeNo)
    if err != nil { return err }
    if granted {
        quotaToAdd += int(BonusAmount × QuotaPerUnit)
    } else {
        topUp.BonusAmount = 0 // 实际未发放，落库归零以保证历史展示与对账准确
    }
}
```

幂等性：回调重放时订单已是 `Success`，在函数开头 early-return，claim 不会重复插入。

### 6. 配置校验

`model/option.go` 仿 `normalizeAmountBonusOptionValue`，为 `payment_setting.amount_bonus_limit` 增加校验：必须是 `map[int]int`，金额>0、次数>=0。

### 7. 前端

- 配置页（`payment-settings-section` / 可视化编辑器 `amount-bonus-visual-editor`）：每个档位「赠送额」旁加「可享次数」输入（0/空 = 不限）。
- 历史记录展示：`BonusAmount` 语义已收敛为「实际发放赠送」，前端无需改动。
- i18n：新增「可享次数」文案。

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `setting/operation_setting/payment_setting.go` | 加 `AmountBonusLimit` 字段及默认值 |
| `model/topup_bonus_claim.go`（新建） | `TopUpBonusClaim` 表 + `claimTopUpBonus` |
| `model/main.go` | AutoMigrate 注册新表 |
| `model/topup.go` | `TopUp` 加 `BonusTier`；6 个入账函数接入判次 helper |
| `controller/topup.go` | `configuredTopUpAmounts` Amount 不含赠送；下单填 `BonusTier` |
| `controller/topup_stripe.go` / `_paddle.go` / `_waffo.go` / `_waffo_pancake.go` | 下单填 `BonusTier` |
| `model/option.go` | `amount_bonus_limit` 配置校验 |
| 前端配置页 + i18n | 「可享次数」输入项 |
| 测试 | claim 原子性 / 超限不送 / 并发竞争 / 幂等 / 各渠道一致性 |

## 测试计划

- `claimTopUpBonus`：limit=0 不限次恒发；limit=N 第 N+1 次拒发；并发插同 Seq 仅一笔成功。
- 各渠道回调：未超限发本金+赠送、超限仅发本金、`BonusAmount` 落库与实际发放一致。
- 幂等：回调重放不重复计次、不重复发放。
- 配置校验：非法 `amount_bonus_limit` 被拒、空值归一化。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 并发同档位同时支付成功重复发赠送 | `(UserId,Tier,Seq)` 唯一索引原子裁决 |
| 回调重放重复计次 | 现有 `Status==Success` early-return 门控 |
| 存量订单无 `BonusTier` | 默认 0；存量赠送逻辑此前固化在 Amount，不走新路径，历史不受影响 |
| 改 `configuredTopUpAmounts` 语义影响既有测试 | 同步更新 `controller/topup_bonus_test.go` 与 `payment_method_guard_test.go` |

## 实现顺序

1. 配置结构 + 校验（`payment_setting.go`、`option.go`）
2. 计次表 + 原子函数（`topup_bonus_claim.go`、`main.go`）
3. `TopUp` 加 `BonusTier`，下单侧改 `configuredTopUpAmounts` 及各渠道
4. 回调侧 6 路接入判次 helper
5. 前端配置项 + i18n
6. 测试补齐
