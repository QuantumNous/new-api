# 付费分组与资金来源策略配置指南（v2 简化方案）

> 版本：1.2.11+
> 日期：2026-07-10
> 适用场景：公司分配套餐只能用于公司分组模型，用户购买付费套餐后可使用高级模型，高级模型只扣个人付费额度

---

## 方案概览

```
用户主分组 = company_l3（永不变）
公司套餐 bind_group = company_l3（已有）
付费套餐 bind_group = paid_model（新增 1 个）

用户购买付费套餐后：
  → 自动获得 paid_model 分组的渠道访问权（通过活跃订阅的 bind_group）
  → 不改变主分组
  → 使用 company_l3 分组 → 扣公司套餐
  → 使用 paid_model 分组 → 扣付费套餐（Billing Group Funding 排除公司套餐）
```

### v2 vs v1 对比

| | v1 复杂方案 | v2 简化方案 |
|---|---|---|
| 付费套餐数量 | 7 个 | **1 个** |
| 付费升级分组 | 7 个 | **0 个** |
| 用户分组切换 | 需要 | **不需要** |
| 到期降级 | 需要 | **不需要** |
| 配置复杂度 | 高 | **极低** |

---

## 第一步：创建付费分组

在**渠道管理**里，编辑或新建渠道时，在"分组"字段填入新的分组名。

| 分组名 | 用途 | 绑定的模型示例 |
|--------|------|---------------|
| `paid_model` | 付费文本模型 | deepseek-v3, claude-sonnet 等 |
| `image_model` | 画图模型 | dall-e-3, flux 等 |
| `premium_model` | 高级模型 | gpt-4.1, claude-opus 等 |

操作：编辑渠道 → 在"分组"字段加入这些名称 → 保存。

---

## 第二步：创建付费套餐（只需 1 个）

在**订阅套餐管理**页面，创建 1 个付费套餐。

| 字段 | 值 | 说明 |
|------|-----|------|
| 名称 | `高级模型套餐` | 用户看到的名称 |
| 价格 | `49.9` | 用户购买价格 |
| **Bind Group** | `paid_model` | 用户购买后自动获得此分组的访问权 |
| **Upgrade Group** | 留空 | 不切换用户分组 |
| **Downgrade Group** | 留空 | 不需要降级 |
| **Total Amount** | `200000` | 付费套餐额度 |
| **Duration** | `1 个月` | 有效期 |
| **Allow Balance Pay** | 开启 | 允许用钱包余额购买 |
| **Allow Wallet Overflow** | 开启 | 额度用完后回退钱包 |

> 如果有多个付费分组（paid_model + image_model + premium_model），可以创建多个套餐分别绑定不同分组，也可以创建一个套餐绑定 `paid_model`，再创建其他套餐绑定 `image_model`、`premium_model`。

---

## 第三步：配置资金来源策略

在 **系统设置 → Billing & Payment → Billing Group Funding** 中，填入需要个人付费的分组名称（每行一个）：

```
paid_model
image_model
premium_model
```

保存。

### 效果

- 用户使用上述分组的模型时，系统排除 `source=bind_group` 的公司自动分配套餐
- 只允许扣减个人自购套餐（`source=order/balance/admin`）或钱包余额
- 使用公司原生分组时不受影响，走原有计费逻辑

---

## 第四步：配置分组倍率（可选）

在 **系统设置 → Billing & Payment → Group Pricing** 里，给各分组设置倍率。

| 分组 | 倍率 | 说明 |
|------|------|------|
| `company_l1` ~ `company_l7` | 1.0 | 公司分组原价 |
| `paid_model` | 1.0 | 付费模型分组 |
| `image_model` | 2.0 | 画图更贵 |
| `premium_model` | 3.0 | 高级模型最贵 |

---

## 完整流程示例（以 L3 用户为例）

```
1. 用户初始状态
   主分组 = company_l3
   拥有：公司套餐 L3（自动绑定，bind_group=company_l3）
   可用分组 = company_l3

2. 用户在订阅页面看到"高级模型套餐"
   点击购买 → 支付 49.9 元

3. 购买成功后
   新增订阅：付费套餐（bind_group=paid_model, 200000 额度）
   可用分组自动变为：company_l3 + paid_model
   （主分组不变，仍是 company_l3）

4. 日常使用
   用 company_l3 分组 → 扣公司套餐额度 ✓
   用 paid_model 分组 → 扣付费套餐额度（排除公司套餐）✓
   付费套餐用完 → 自动扣钱包余额 ✓

5. 付费套餐到期后
   可用分组自动恢复为 company_l3
   用户回到纯公司套餐状态
```

---

## 注意事项

1. **分组名称必须一致**：渠道里的分组、Billing Group Funding 里的分组，名称要完全对上

2. **先配渠道分组**：确保付费分组已经绑定了对应模型的渠道，否则用户选了分组但没渠道可用

3. **不需要改用户主分组**：v2 方案通过订阅的 bind_group 自动扩展可用分组

4. **不需要配 GroupSpecialUsableGroup**：v2 方案通过订阅自动获得分组访问权，不需要手动配置分组可用范围

5. **测试验证**：配完后用一个测试用户购买套餐，然后分别用 `company_l3` 和 `paid_model` 分组发请求，检查日志里扣的是哪个订阅

---

## 技术原理

### 订阅驱动分组访问

用户可用分组的计算逻辑（v2 新增）：

```
GetUserUsableGroupsWithSubscriptions(userGroup, userId):
    1. 原有逻辑：系统配置的可用分组
    2. 新增：查询用户活跃订阅的 plan.bind_group
    3. 合并返回
```

相关代码：
- `model/subscription.go` — `GetActiveSubscriptionBindGroups(userId)`
- `service/group.go` — `GetUserUsableGroupsWithSubscriptions(userGroup, userId)`
- `middleware/auth.go` — Token 分组校验
- `middleware/distributor.go` — Playground 分组校验
- `controller/user.go` — 返回用户可用分组列表

### 资金来源隔离

当用户使用付费分组时，计费链路会：
1. 检查 `UsingGroup` 是否在 `personal_funding_groups` 配置中
2. 如果是，排除 `source=bind_group` 的公司自动分配套餐
3. 只允许扣减个人自购套餐或钱包余额

相关代码：
- `setting/operation_setting/billing_group_setting.go` — 配置定义
- `service/billing_session.go` — 计费链路判断
- `model/subscription.go` — 排除 bind_group 的订阅查询

---

## 相关文件

- 设计文档：`docs/superpowers/specs/2026-07-10-billing-group-funding-policy-design.md`
- 本配置指南：`docs/guides/billing-group-funding-setup-guide.md`
