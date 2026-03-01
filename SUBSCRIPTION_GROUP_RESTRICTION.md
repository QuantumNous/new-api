# 订阅套餐分组限制功能

## 功能概述

此功能允许管理员为订阅套餐配置可使用的分组限制。当用户购买了带有分组限制的套餐后，该用户只能使用套餐中指定的分组，无法访问其他分组。

## 数据库变更

### 新增字段

在 `subscription_plans` 表中新增字段：

- `allowed_groups` (varchar(512)): 允许使用的分组列表，多个分组用逗号分隔，空值表示不限制（允许所有分组）

## API 变更

### 管理员 API

#### 创建/更新订阅套餐

在创建或更新订阅套餐时，可以设置 `allowed_groups` 字段：

```json
{
  "plan": {
    "title": "VIP套餐",
    "allowed_groups": "vip,premium",
    ...
  }
}
```

- `allowed_groups` 为空字符串或不设置：不限制分组，用户可以使用所有分组
- `allowed_groups` 设置为逗号分隔的分组列表：用户只能使用列表中的分组

#### 验证规则

- 创建/更新套餐时，系统会验证 `allowed_groups` 中的每个分组是否存在于系统分组配置中
- 如果分组不存在，会返回错误："允许的分组不存在: {分组名}"

## 使用流程

### 1. 管理员配置套餐

管理员在创建或编辑订阅套餐时，可以设置 `allowed_groups` 字段：

- 留空：用户可以使用所有分组（默认行为）
- 设置分组列表：例如 "vip,premium,enterprise"，用户只能使用这些分组

### 2. 用户购买套餐

用户购买套餐后，系统会记录该套餐的分组限制。

### 3. API 请求时的分组验证

当用户发起 API 请求时：

1. 系统获取用户当前激活的订阅套餐
2. 检查套餐是否有分组限制（`allowed_groups` 不为空）
3. 如果有限制：
   - 对于明确指定的分组：验证该分组是否在允许列表中
   - 对于 `auto` 分组：在自动选择分组后，验证选中的分组是否在允许列表中
4. 如果分组不在允许列表中，返回错误："您的订阅套餐限制了可使用的分组，当前分组不在允许范围内"

## 错误消息

### 中文
```
您的订阅套餐限制了可使用的分组，当前分组不在允许范围内
```

### 英文
```
Your subscription plan restricts the groups you can use, the current group is not allowed
```

### 繁体中文
```
您的訂閱套餐限制了可使用的分組，當前分組不在允許範圍內
```

## 代码实现

### 模型层 (model/subscription.go)

- `SubscriptionPlan.AllowedGroups`: 存储允许的分组列表
- `SubscriptionPlan.GetAllowedGroupsList()`: 解析并返回分组列表
- `SubscriptionPlan.IsGroupAllowed(group)`: 检查指定分组是否被允许
- `GetUserActiveSubscriptionPlan(userId)`: 获取用户当前激活的订阅套餐

### 控制器层 (controller/subscription.go)

- 在创建和更新套餐时验证 `allowed_groups` 字段
- 确保所有指定的分组都存在于系统配置中

### 中间件层 (middleware/distributor.go)

- 在分组选择前检查订阅限制
- 对于明确指定的分组，立即验证
- 对于 `auto` 分组，在自动选择后验证

### 国际化 (i18n/)

- 添加了新的错误消息键：`distributor.subscription_group_restricted`
- 支持中文、英文、繁体中文

## 测试

运行测试：

```bash
go test -v ./model -run TestSubscriptionPlan
```

测试覆盖：
- 空分组列表（允许所有分组）
- 单个分组
- 多个分组
- 带空格的分组
- 分组验证逻辑

## 使用示例

### 示例 1：创建限制分组的套餐

```bash
POST /api/admin/subscription/plans
{
  "plan": {
    "title": "VIP套餐",
    "subtitle": "仅限VIP和Premium分组",
    "price_amount": 99.99,
    "duration_unit": "month",
    "duration_value": 1,
    "upgrade_group": "vip",
    "allowed_groups": "vip,premium",
    "total_amount": 1000000
  }
}
```

### 示例 2：创建不限制分组的套餐

```bash
POST /api/admin/subscription/plans
{
  "plan": {
    "title": "标准套餐",
    "subtitle": "可使用所有分组",
    "price_amount": 49.99,
    "duration_unit": "month",
    "duration_value": 1,
    "upgrade_group": "default",
    "allowed_groups": "",
    "total_amount": 500000
  }
}
```

### 示例 3：用户请求被限制

用户购买了只允许 "vip,premium" 分组的套餐，但尝试使用 "enterprise" 分组：

```bash
POST /v1/chat/completions
Headers:
  Authorization: Bearer sk-xxx
Body:
{
  "model": "gpt-4",
  "messages": [...]
}
```

如果用户的 token 配置使用 "enterprise" 分组，将返回：

```json
{
  "error": {
    "message": "您的订阅套餐限制了可使用的分组，当前分组不在允许范围内",
    "type": "invalid_request_error"
  }
}
```

## 注意事项

1. **向后兼容**：现有套餐的 `allowed_groups` 字段默认为空，表示不限制分组，保持原有行为
2. **数据库迁移**：GORM AutoMigrate 会自动添加新字段，SQLite 有专门的迁移逻辑
3. **性能考虑**：分组验证在每次 API 请求时执行，但查询已经过缓存优化
4. **多订阅处理**：如果用户有多个激活的订阅，系统使用最新开始的订阅的限制规则
5. **分组格式**：分组名称用逗号分隔，系统会自动去除空格和空值

## 未来扩展

可能的扩展方向：

1. 支持分组黑名单（禁止使用某些分组）
2. 支持模型级别的限制（某些套餐只能使用特定模型）
3. 支持时间段限制（某些时间段只能使用特定分组）
4. 支持配额分配（不同分组有不同的配额限制）
