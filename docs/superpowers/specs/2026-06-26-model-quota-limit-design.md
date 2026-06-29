# 模型额度限制（Model Quota Limit）功能设计

> 日期：2026-06-26
> 状态：已确认，待实现
> 方法论：TDD 先行

## 1. 需求背景

现有系统的用户额度和订阅套餐都是**总额度池**模式，所有模型（从最便宜到最昂贵）共用一个额度。在 GPT-5.5 等高成本模型场景下，管理员无法单独限制某用户/某分组/某套餐对特定模型的消耗上限。

### 核心需求

1. 支持**按分组**和**按订阅套餐**配置模型的额度限制规则
2. 规则最终**作用到用户级**进行实时限制
3. 模型额度耗尽时**直接拒绝请求**（403）
4. 限额周期**跟随订阅周期**自动重置
5. 模型匹配支持**精确匹配**和**前缀通配**（管理员自选）
6. 模型限额是总额度的**子池**（限额是总额度的一部分，不是额外叠加）
7. **完全不改现有计费逻辑**，模型限额作为独立中间件拦截层

## 2. 数据模型

### 2.1 新增 3 张表

**表 1：`model_quota_group_rules`（分组级规则定义）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int PK | |
| `group_name` | varchar(64) | 用户分组名（如 `default`、`vip`） |
| `model_pattern` | varchar(128) | 模型匹配名（如 `gpt-5.5`） |
| `match_mode` | varchar(16) | `exact`（精确）或 `prefix`（通配前缀） |
| `quota_limit` | bigint | 该模型允许消耗的最大额度（单位与系统 quota 一致） |
| `enabled` | bool | 是否启用 |
| `sort_order` | int | 多条规则优先级 |
| `created_at` | bigint | |
| `updated_at` | bigint | |

**表 2：`model_quota_plan_rules`（套餐级规则定义）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int PK | |
| `plan_id` | int | 关联 `subscription_plans.id` |
| `model_pattern` | varchar(128) | |
| `match_mode` | varchar(16) | `exact` / `prefix` |
| `quota_limit` | bigint | |
| `enabled` | bool | |
| `sort_order` | int | |
| `created_at` | bigint | |
| `updated_at` | bigint | |

**表 3：`user_model_quota_usage`（用户级实时消耗计数器）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int PK | |
| `user_id` | int | 用户 ID（联合索引 `idx_user_period`） |
| `rule_id` | int | 来源规则 ID |
| `rule_source` | varchar(16) | `group` / `plan` |
| `model_pattern` | varchar(128) | 冗余存储，用于查询展示 |
| `subscription_id` | int | 关联 `user_subscriptions.id`（0=分组规则，无订阅） |
| `quota_limit` | bigint | 快照：该规则的限额（创建时拷贝） |
| `quota_used` | bigint | 实时消耗累计 |
| `period_start` | bigint | 周期开始时间戳 |
| `period_end` | bigint | 周期结束时间戳（联合索引 `idx_user_period`） |
| `status` | varchar(16) | `active` / `expired` |
| `created_at` | bigint | |
| `updated_at` | bigint | |

### 2.2 索引设计

```sql
-- 分组规则查询
CREATE INDEX idx_group_rules ON model_quota_group_rules(group_name, enabled);

-- 套餐规则查询
CREATE INDEX idx_plan_rules ON model_quota_plan_rules(plan_id, enabled);

-- 用户活跃计数器查询（核心高频路径）
CREATE INDEX idx_user_period ON user_model_quota_usage(user_id, period_end, status);
```

### 2.3 计数器懒创建策略

- 首次命中规则时才创建 `user_model_quota_usage` 记录
- 避免为所有用户预创建空数据
- `quota_limit` 在创建时从规则快照拷贝，规则修改不影响已生成的计数器

## 3. Redis 双写设计

### 3.1 设计原则

完全复用现有用户额度（`User.Quota`）的 Redis 双写模式：
- Redis 作为高性能读缓存（`HIncrBy` 原子计数）
- DB 作为数据持久层（`gorm.Expr` 原子更新或 BatchUpdate）
- Redis 不可用时自动回退 DB 查询
- Redis 操作异步执行，失败只记日志不影响主流程

### 3.2 Redis Key 设计

```
Key:   user_model_quota:{userId}:{usageId}
Type:  Hash
Fields:
  quota_used    (int)    — 已消耗额度（原子 HIncrBy 更新）
  quota_limit   (int)    — 限额快照（创建时设置）
  period_end    (int64)  — 周期结束时间戳
TTL:   period_end - now（随订阅周期自动过期，实现自动重置）
```

### 3.3 复用的 Redis 基础设施

| 资产 | 文件 | 复用方式 |
|------|------|---------|
| `RedisHIncrBy` | `common/redis.go` | 原子增减 `quota_used` |
| `RedisHGetObj` | `common/redis.go` | 读取计数器状态 |
| `TxPipeline` | `common/redis.go` | 多字段原子写入 |
| `BatchUpdate` | `model/utils.go` | 新增 `ModelQuotaUsage` 批量类型 |

### 3.4 读路径

```
GetModelQuotaUsed(userId, usageId):
  1) Redis: HGET user_model_quota:{userId}:{usageId} quota_used
  2) 命中 → 返回
  3) 未命中 → DB: SELECT quota_used FROM user_model_quota_usage WHERE id=?
  4) 回填 Redis（带 TTL）
```

### 3.5 写路径

```
IncreaseModelQuotaUsage(usageId, delta):
  1) Redis: HINCRBY user_model_quota:{userId}:{usageId} quota_used +delta  (异步 gopool.Go)
  2) if BatchUpdateEnabled:
       addNewRecord(ModelQuotaUsage, usageId, delta)  // 进内存批处理
  3) else:
       UPDATE user_model_quota_usage SET quota_used = quota_used + ? WHERE id=?
```

### 3.6 不使用 cachex

`cachex`（`pkg/cachex`）只有 Get/Set 语义，不支持原子计数操作（INCR/HIncrBy）。模型限额计数器必须用 `common.RedisHIncrBy` 或直接 `common.RDB.TxPipeline()`。

## 4. 计费链路集成（独立拦截层）

### 4.1 核心原则：不碰现有计费逻辑

以下文件**完全不改**：

- `service/billing_session.go` — 计费会话
- `service/funding_source.go` — 资金来源
- `service/quota.go` — 预扣/结算/退款
- `service/pre_consume_quota.go` — 预扣入口
- `model/user.go` — 用户额度
- `model/token.go` — 令牌额度
- `model/subscription.go` — 订阅额度

### 4.2 拦截架构

```
请求到达
  ↓
[现有] Token 认证 → 模型白名单检查 → 模型限流检查
  ↓
【新增】模型额度限制检查 ← 独立中间件 middleware/model_quota_limit.go
  ↓
[现有] 计费预扣 → 转发上游 → 计费结算 → 日志记录
  ↓
【新增】日志记录后异步回写计数器 ← 1行 gopool.Go，不改计费逻辑
```

### 4.3 中间件检查逻辑

```go
// middleware/model_quota_limit.go
func ModelQuotaLimit(c *gin.Context) {
    userId := c.GetInt("id")
    model := getModelName(c)
    userGroup := c.GetString("group")

    // 1. 查匹配规则（规则本身用 cachex 缓存，读多写少）
    rules := service.FindMatchingModelQuotaRules(userId, model, userGroup)
    if len(rules) == 0 {
        c.Next()  // 无规则，直接放行
        return
    }

    // 2. 预估本次消耗（复用现有 preConsumedQuota 计算逻辑）
    preQuota := estimatePreConsumeQuota(c)

    // 3. 检查每条规则
    var matchedUsageIds []int
    for _, rule := range rules {
        usage := service.GetOrCreateModelQuotaUsage(userId, rule, subscriptionId)
        used := service.GetModelQuotaUsed(userId, usage.Id)  // Redis 优先
        if used + preQuota > usage.QuotaLimit {
            abortWithModelQuotaExhausted(c, model, rule)  // → 403
            return
        }
        matchedUsageIds = append(matchedUsageIds, usage.Id)
    }

    c.Set("model_quota_usage_ids", matchedUsageIds)
    c.Next()
}
```

### 4.4 回写逻辑

请求完成后（日志记录之后），异步更新计数器：

```go
// controller/relay.go 末尾新增 1 行
gopool.Go(func() {
    actualQuota := relayInfo.GetQuota()
    usageIds := c.GetIntSlice("model_quota_usage_ids")
    for _, id := range usageIds {
        service.IncreaseModelQuotaUsage(id, actualQuota)
    }
})
```

### 4.5 误差处理

- 检查时用预估量，实际回写用真实消耗量
- 下次请求检查时读到修正后的真实值
- 最差情况：一个请求的偏差 = 预估与实际的差额（通常 < 5%）
- 对限额精度影响可忽略

### 4.6 规则匹配优先级

```
用户请求模型 M
  ↓
1. 查 user_model_quota_usage 中该用户的活跃计数器
   WHERE user_id=? AND model M 匹配 model_pattern AND period_end > now AND status='active'
   ↓ 命中 → 检查 quota_used + 预扣量 <= quota_limit
   ↓ 无命中
2. 查套餐规则（如果用户有活跃订阅）
   plan_id → model_quota_plan_rules → 匹配模型 M
   ↓ 命中 → 创建 usage 计数器，period 跟随订阅周期
   ↓ 无命中
3. 查分组规则
   user.Group → model_quota_group_rules → 匹配模型 M
   ↓ 命中 → 创建 usage 计数器，period 跟随订阅周期（或默认30天）
   ↓ 无命中 → 无限制，正常放行
```

### 4.7 模型匹配函数

```go
func matchModel(modelName, pattern, mode string) bool {
    switch mode {
    case "exact":
        return modelName == pattern
    case "prefix":
        return strings.HasPrefix(modelName, pattern)
    }
    return false
}
```

### 4.8 周期重置

- **跟随订阅周期**：计数器的 `period_end` 设为订阅的 `next_reset_time`
- **Redis TTL 自动过期**：key 在 `period_end` 时自动过期
- **DB 过期标记**：定时任务将 `period_end < now` 的记录标记为 `expired`
- **新周期懒创建**：下次请求命中规则时创建新的 `active` 计数器
- **手动重置**：管理员可通过 API 手动重置某条记录

## 5. 后端 API

### 5.1 分组规则管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/model-quota/group-rules` | 列表（支持 `group_name` 筛选） |
| POST | `/api/model-quota/group-rules` | 创建规则 |
| PUT | `/api/model-quota/group-rules/:id` | 编辑规则 |
| DELETE | `/api/model-quota/group-rules/:id` | 删除规则 |

### 5.2 套餐规则管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/model-quota/plan-rules?plan_id=1` | 列表 |
| POST | `/api/model-quota/plan-rules` | 创建规则 |
| PUT | `/api/model-quota/plan-rules/:id` | 编辑规则 |
| DELETE | `/api/model-quota/plan-rules/:id` | 删除规则 |

### 5.3 用户使用情况

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/model-quota/user-usage?user_id=101` | 查看某用户的限额使用情况 |
| POST | `/api/model-quota/user-usage/:id/reset` | 管理员手动重置 |

## 6. 前端页面

### 6.1 规则配置页面

路由：`/settings/model-quota-rules`（管理员可见，Settings 分组下）

两个 Tab：
- **Tab 1 "Group Rules"**：分组规则列表
  - 列：分组名、模型匹配、匹配模式、额度限制（显示为美元/CNY）、已启用、操作
- **Tab 2 "Plan Rules"**：套餐规则列表
  - 列：套餐名、模型匹配、匹配模式、额度限制、已启用、操作

创建/编辑对话框：分组/套餐选择、模型名、匹配模式（精确/前缀）、额度输入

### 6.2 用户额度详情

在用户管理行操作菜单中新增"模型额度详情"按钮：
- 弹出 Dialog，展示该用户所有模型限额的使用进度
- 每行：模型名、限额、已用、剩余、进度条、周期、重置时间
- 管理员可点"重置"按钮

### 6.3 用户端展示

在用户个人页面新增"模型额度"区块（只读）：
- 进度条：绿色（<70%）、黄色（70-90%）、红色（>90%）

## 7. 文件改动清单

### 7.1 后端新建（6 文件）

| 文件 | 用途 |
|------|------|
| `model/model_quota.go` | 3 张表 struct + CRUD + 查询 |
| `model/model_quota_cache.go` | Redis 双写函数 |
| `service/model_quota.go` | 核心业务逻辑 |
| `middleware/model_quota_limit.go` | 独立拦截中间件 |
| `controller/model_quota.go` | 9 个接口 |
| `i18n/locales/*.yaml` | 错误消息翻译 |

### 7.2 后端修改（5 文件）

| 文件 | 改动 |
|------|------|
| `model/main.go` | 注册 3 张新表 AutoMigrate |
| `model/utils.go` | BatchUpdate 新增 ModelQuotaUsage 类型 |
| `router/api-router.go` | 注册中间件 + 9 条 API 路由 |
| `controller/relay.go` | 请求完成后 1 行异步回写 |
| `i18n/keys.go` | 新增消息常量 |

### 7.3 前端新建（4 文件）

| 文件 | 用途 |
|------|------|
| `features/model-quota/api.ts` | API 调用 |
| `features/model-quota/types.ts` | 类型定义 |
| `features/model-quota/model-quota-rules-page.tsx` | 规则配置页面（双 Tab） |
| `features/model-quota/user-model-quota-dialog.tsx` | 用户额度详情 Dialog |

### 7.4 前端修改（4 文件）

| 文件 | 改动 |
|------|------|
| `hooks/use-sidebar-data.ts` | 新增菜单项 |
| `routes/_authenticated/settings/model-quota-rules/index.tsx` | 路由 |
| `features/users/components/data-table-row-actions.tsx` | 新增按钮 |
| `i18n/locales/{en,zh}.json` | 新增翻译 |

## 8. 实施计划（TDD 先行）

### 阶段 1: 数据模型层 + 测试

先写测试，再写实现：
```
TDD:
  1. model/model_quota_test.go — 测试表 CRUD、查询
  2. model/model_quota_cache_test.go — 测试 Redis 双写逻辑

实现:
  3. model/model_quota.go (struct + migrate + CRUD)
  4. model/model_quota_cache.go (Redis 双写)
  5. model/utils.go (batch update 扩展)

验证: go test ./model/... -run ModelQuota
```

### 阶段 2: 业务逻辑层 + 测试

```
TDD:
  1. service/model_quota_test.go — 测试规则匹配、额度检查、周期重置逻辑

实现:
  2. service/model_quota.go (匹配 + 检查 + 回写 + 重置)

验证: go test ./service/... -run ModelQuota
```

### 阶段 3: 中间件 + 控制器 + 路由 + 测试

```
TDD:
  1. middleware/model_quota_limit_test.go — 测试中间件拦截行为
  2. controller/model_quota_test.go — 测试 API 接口

实现:
  3. middleware/model_quota_limit.go
  4. controller/model_quota.go
  5. router/api-router.go
  6. controller/relay.go (1行异步回写)
  7. i18n keys + locales

验证: go build && go test ./...
```

### 阶段 4: 前端规则配置

```
实现:
  1. types + api
  2. model-quota-rules-page (双Tab)
  3. 路由 + 侧边栏
  4. i18n

验证: bun run build
```

### 阶段 5: 前端用户展示

```
实现:
  1. user-model-quota-dialog
  2. data-table-row-actions 集成

验证: bun run build
```

## 9. 测试策略

### 9.1 单元测试覆盖

| 模块 | 测试文件 | 测试内容 |
|------|---------|---------|
| 数据模型 | `model/model_quota_test.go` | CRUD、查询、索引命中 |
| Redis 缓存 | `model/model_quota_cache_test.go` | 双写一致性、TTL 过期、Redis 不可用回退 |
| 规则匹配 | `service/model_quota_test.go` | 精确匹配、前缀匹配、多规则优先级 |
| 额度检查 | `service/model_quota_test.go` | 余额充足/不足边界、并发安全 |
| 中间件 | `middleware/model_quota_limit_test.go` | 放行、拦截403、无规则放行 |
| 控制器 | `controller/model_quota_test.go` | CRUD 接口、参数校验、权限 |

### 9.2 关键测试场景

1. **限额耗尽拦截**：用户消耗达到 quota_limit，下一次请求被 403 拦截
2. **限额未耗尽放行**：消耗 < quota_limit，请求正常通过
3. **周期重置**：period_end 过期后，新请求创建新计数器
4. **Redis 故障回退**：Redis 不可用时，回退 DB 查询仍能正确拦截
5. **精确匹配 vs 前缀匹配**：`gpt-5.5` 精确模式不匹配 `gpt-5.5-mini`，前缀模式匹配
6. **多规则叠加**：用户同时命中分组规则和套餐规则，两条都要检查
7. **规则修改不影响已有计数器**：修改 quota_limit 后，已创建的 usage 快照不变
8. **并发安全**：多个请求同时到达，Redis HIncrBy 保证原子性
