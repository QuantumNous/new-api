# 订阅驱动分组访问 + 资金来源策略 设计

> 日期：2026-07-10（v2 简化方案）
> 状态：实现中
> 方法论：TDD → 最小改动

## 1. 需求背景

公司有 7 个用户分组，每个分组绑定不同的公司套餐（`source = bind_group`），由公司自动分配。

用户购买付费套餐后，应自动获得付费分组的访问权，使用付费模型时只扣个人付费额度。

## 2. v1 方案回顾与简化

### v1 方案（已废弃）

需要为每个公司等级创建 paid_l1~paid_l7 共 7 个升级分组 + 7 个付费套餐，用户购买后切换主分组。问题：配置量大、维护复杂。

### v2 方案（当前）

**核心思路：订阅驱动分组访问权 + 计费策略做资金隔离。**

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

## 3. 与 v1 的对比

| | v1 复杂方案 | v2 简化方案 |
|---|---|---|
| 付费套餐数量 | 7 个 | **1 个** |
| 付费升级分组 | 7 个 | **0 个** |
| 用户分组切换 | 需要 | **不需要** |
| 到期降级 | 需要 | **不需要**（套餐到期自动失去分组访问权） |
| 配置复杂度 | 高 | **极低** |

## 4. 现有系统能力分析

### 已完成（v1 时开发）

- Billing Group Funding 策略：`setting/operation_setting/billing_group_setting.go`
- 计费链路排除公司套餐：`service/billing_session.go`
- 订阅查询排除 bind_group：`model/subscription.go`

### 缺失（本次开发）

用户可用分组（`GetUserUsableGroups`）只看主分组的系统配置，不看用户买了什么订阅。

`GetUserUsableGroups` 当前实现：

```go
func GetUserUsableGroups(userGroup string) map[string]string {
    // 只看 UserUsableGroups + GroupSpecialUsableGroup
    // 不看用户订阅
}
```

**缺口**：用户购买付费套餐（`bind_group = paid_model`）后，无法自动获得 `paid_model` 分组的访问权。

## 5. 开发内容

### 5.1 Model 层：查询活跃订阅的 bind_group

在 `model/subscription.go` 新增：

```go
func GetActiveSubscriptionBindGroups(userId int) ([]string, error)
```

查询用户活跃订阅对应 Plan 的 `bind_group`，返回去重后的分组名列表。

### 5.2 Service 层：可用分组合并订阅分组

在 `service/group.go` 新增：

```go
func GetUserUsableGroupsWithSubscriptions(userGroup string, userId int) map[string]string
```

在原有逻辑基础上，额外加入用户活跃订阅的 `bind_group`。

### 5.3 调用方改造

将 `GetUserUsableGroups(userGroup)` 的调用改为 `GetUserUsableGroupsWithSubscriptions(userGroup, userId)`：

- `middleware/distributor.go` — Playground 分组选择校验
- `middleware/auth.go` — Token 分组权限校验

### 5.4 不改动的部分

- 用户表结构
- 订阅表结构
- 渠道配置
- Billing Group Funding 策略（已完成）
- 计费链路排除逻辑（已完成）

## 6. TDD 测试计划

| 测试 | 文件 | 验证点 |
|------|------|--------|
| GetActiveSubscriptionBindGroups | model 层测试 | 返回活跃订阅对应的 bind_group 列表 |
| GetUserUsableGroupsWithSubscriptions | service 层测试 | 原有可用分组 + 订阅 bind_group 合并 |
| 调用方传入 userId | 编译通过 | distributor/auth 正确传参 |

## 7. 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `model/subscription.go` | 新增函数 | GetActiveSubscriptionBindGroups |
| `service/group.go` | 新增函数 | GetUserUsableGroupsWithSubscriptions |
| `middleware/distributor.go` | 修改调用 | 传入 userId |
| `middleware/auth.go` | 修改调用 | 传入 userId |
| `docs/superpowers/specs/2026-07-10-billing-group-funding-policy-design.md` | 更新 | 本文档 |

## 8. 配置使用说明

### 运维配置

1. 创建付费套餐：`bind_group = paid_model`
2. 配置 Billing Group Funding：`personal_funding_groups = ["paid_model"]`
3. 渠道里给 `paid_model` 分组绑定高级模型

### 运行时效果

```
未购买付费套餐的 company_l3 用户：
  可用分组 = company_l3
  用 paid_model → 报错（分组不可用）

已购买付费套餐的 company_l3 用户：
  可用分组 = company_l3 + paid_model
  用 company_l3 → 扣公司套餐 ✓
  用 paid_model → 扣付费套餐（排除公司套餐）✓

付费套餐到期后：
  可用分组自动恢复为 company_l3
```
