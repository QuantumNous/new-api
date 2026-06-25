# 充值赠送按用户组白名单生效（opt-in）

日期：2026-06-22
状态：已确认，待实现

## 背景与问题

系统用户分两类（`model.User`）：

- **B 端企业用户** `IsEnterprise=true` —— 保留用户组概念，可属于不同 `Group`
- **C 端用户** `IsEnterprise=false` —— 被强制锁在 `plg` 组

当前充值赠送（`PaymentSetting.AmountBonus`）是**全局**的：`controller/topup.go` 的
`configuredTopUpBonusAmount()` 只按充值金额档位计算赠送，完全不看用户组，B/C 端一视同仁。

目标：让"哪些用户组能享某档位的充值赠送"可配置。运营希望默认收紧——不显式授权就不送，
并支持一个 `all` 关键字代表"所有组"。

## 设计决策（已与用户确认）

1. **粒度**：按用户组 `Group` 字段（不是 `IsEnterprise` 二分），灵活，未来可对任意组开口子。
2. **配置形态**：**每个充值档位**各配一份用户组白名单（`map[档位金额][]用户组`）。
3. **缺省语义（opt-in，关键反转）**：
   | 配置情况 | 行为 |
   |---|---|
   | 某档位**未配** / 配了**空数组** | **谁都不送** |
   | 配了 `["all"]` | 所有用户组都送 |
   | 配了 `["plg"]` | 仅 `plg` 组（= C 端）送 |
   | 配了 `["plg","vip"]` | 列表内的组送 |

   `all` 为保留关键字（代码现无占用）。命中 `all` 或精确命中组名即放行。

4. **上线影响（用户已知悉并接受）**：功能上线后，在管理员配置 `amount_bonus_groups` 之前，
   所有档位赠送立即全部停发（空=不送）。用户将上线后自行按新活动逐档配 `all` 或具体组。

## 架构与改动点

### 1. 数据结构 — `setting/operation_setting/payment_setting.go`

`PaymentSetting` 新增字段，与 `AmountBonus` / `AmountBonusLimit` 平级：

```go
// 档位金额 → 可享该档位赠送的用户组白名单。
// 未配 / 空数组 = 谁都不送（opt-in，必须显式授权）。
// 含 "all" = 所有用户组都送。否则仅命中列表内用户组才送。
// 限制：与 AmountBonus 同源，key 是充值金额，仅 USD/CNY 展示模式生效。
AmountBonusGroups map[int][]string `json:"amount_bonus_groups"`
```

默认值 `paymentSetting` 里初始化为空 map。配置框架（`setting/config/config.go`）对 map 字段
自动 JSON 反序列化（且分配 fresh map，移除的 key 会被正确清除），无需手写读写。

### 2. 后端判定 — `controller/topup.go`（发钱的唯一权威）

新增常量与判定函数：

```go
const TopUpBonusGroupAll = "all"

// opt-in：未配/空 = 不送；含 "all" = 全送；否则命中才送。
func topUpBonusGroupAllowed(tier int, group string) bool {
    groups := operation_setting.GetPaymentSetting().AmountBonusGroups[tier]
    if len(groups) == 0 {
        return false
    }
    for _, g := range groups {
        if g == TopUpBonusGroupAll || g == group {
            return true
        }
    }
    return false
}
```

`configuredTopUpBonusAmount` / `configuredTopUpAmounts` 增加 `group string` 参数，在取到
`AmountBonus[tier]` 后追加白名单校验，不通过返回 0：

```go
func configuredTopUpBonusAmount(requestAmount int64, group string) int64 {
    if requestAmount <= 0 { return 0 }
    bonus, ok := operation_setting.GetPaymentSetting().AmountBonus[int(requestAmount)]
    if !ok { return 0 }
    if !topUpBonusGroupAllowed(int(requestAmount), group) { return 0 }
    return normalizeTopUpBonusAmount(bonus)
}
```

5 个渠道下单处把各自已有的 `group` 变量传入（均已在调用前用
`model.GetUserGroup(id, true)` 取到）：

- `controller/topup.go`（epay，:338）
- `controller/topup_paddle.go`（:193）
- `controller/topup_stripe.go`（:112）
- `controller/topup_waffo.go`（:204）
- `controller/topup_waffo_pancake.go`（:376）

### 3. 配置校验 — `model/option.go`

仿照 `normalizeAmountBonusOptionValue`，加 `normalizeAmountBonusGroupsOptionValue` 并在
`validateAndNormalizeOptionValue` 注册 key `payment_setting.amount_bonus_groups`：
空 → `"{}"`；校验为 `map[int][]string`、档位金额为正整数、组名非空字符串。

### 4. 前端展示过滤 — `controller/topup.go` `GetTopUpInfo`

`GetTopUpInfo`（:120 的 data map）下发 `bonus` 前，按当前用户 group 过滤掉不可享档位，
避免 B 端"看得到拿不到"。判定复用 `topUpBonusGroupAllowed` 保证前后端口径一致。
当前用户 group 用 `model.GetUserGroup(c.GetInt("id"), true)` 取（与 `bonus_remaining` 同款）。

### 5. 前端管理编辑器

- `web/default/src/features/system-settings/integrations/amount-bonus-utils.ts`：
  新增 `amount_bonus_groups` 的解析/序列化/校验函数 + 单测（`amount-bonus-utils.test.ts`）。
- `amount-bonus-visual-editor.tsx`：表格加"生效用户组"列，编辑区加多选（组列表来自
  现有 `GET /api/group?type=user` + `all` 选项）。
- `payment-settings-section.tsx`：表单加 `AmountBonusGroups` 字段，
  保存为 option key `payment_setting.amount_bonus_groups`（仿 `amount_bonus_limit`）。

### 6. 测试 — `controller/topup_bonus_test.go`

补：未配=不送、空数组=不送、`all`=全送、命中组=送、不命中=不送、与限次叠加；
更新现有用例签名（`configuredTopUpBonusAmount` 增加 group 参数）。

## YAGNI / 范围

- 不做 per-tier 之外的全局开关。
- 不动 TOKENS 展示模式（与现有 bonus 一样仅 USD/CNY 生效，沿用现状）。
- 不迁移历史活动配置（用户明确表示上线后自行重配）。
